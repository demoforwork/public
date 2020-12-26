/*
Copyright 2020 Ferris Argyle. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package main

import (
        "encoding/csv"
        "encoding/json"
        "fmt"
        "html/template"
        "io/ioutil"
        "log"
        "net/http"
        "os"
        "path/filepath"
        "strconv"
        "strings"
        "sync"
        "sync/atomic" // for int64 apiCallCount
        "time"

        "github.com/jawher/mow.cli"


        "golang.org/x/net/context"

        "golang.org/x/oauth2/google"
        "google.golang.org/api/admin/directory/v1"
        "google.golang.org/api/googleapi" // for error.Code

)

type cliPtrStruct struct {
        domain *string
        grpAdmin * string
        processType *string
        visType *string
        search *[]string      
        wait *int 
}

type nodeStruct struct {
        //mu sync.Mutex - removed since get append / read race condition with element-level lock
        parentId int
        id int
        label string 
        email string
        group int // this is a vis.js group used to distinguish node types, not a Google group
        color map[string]string 
        clusterNode bool
        directParentCount int
        indirectParentCount int
}

type nodeArrStruct struct {
        // vars need to be exportable to encode 
        mu sync.RWMutex 
        arr []nodeStruct // may be less performant than *nodeStruct pointer, but more straightforward, and delta neglible (nanoseconds) in Groups API context
}

type nodeJSONStruct struct {
        // vars need to be exportable to encode, 
        // so tag to lower case because that's what vis.js data requires
        Id int `json:"id"` 
        Label string `json:"label"`
        Group int `json:"group"` // this is a vis.js group used to distinguish node types, not a Google group
        Color map[string]string `json:"color"`
        ClusterNode bool `json:"clusterNode"`
        Title string `json:"title"` // displayed in popup
}

type edgeStruct struct {
        // vars need to be exportable to encode 
        From int `json:"from"` 
        To int `json:"to"` 
        Color map[string]string `json:"color"`       
}

type edgeArrStruct struct {
        // vars need to be exportable to encode 
        mu sync.RWMutex 
        arr []edgeStruct       
}


type nodeResolutionStruct struct {
        parentId int
        nodeId int
}

type edgeObjStruct struct { // used to resolve nodes with multiple parents (diamond pattern)
        // vars need to be exportable to encode 
        mu sync.Mutex 
        obj map[string]nodeResolutionStruct
}

type parentsJSONStruct struct {
        // vars need to be exportable to encode
        SearchIdentity string
        NodeArr []nodeJSONStruct // may be less performant than *nodeStruct pointer, but more straightforward, and delta neglible (nanoseconds) in Groups API context
        EdgeArr []edgeStruct
}

type searchJSONStruct struct {
        // vars need to be exportable to encode
        SearchPrefix string 
        GroupArr []*admin.Group
}

type cachedResponseStruct struct {
        // vars need to be exportable to encode
        CachedParentsArr []string
        CachedSearchArr []string
}

type indirectParentCountStruct struct {
        counter int
}

const (
        port = "8080"
        staticDir = "static"
        templateDir = "templates"
        templateFile = "groups.html"
        credentialDir = "credentials"
        outputCSVDir = "output/CSV"
        outputJSONSearchDir = "output/JSON/search"
        outputJSONParentsDir = "output/JSON/parents"
        parentsFileName = "parents-"
        searchFileName = "search-"
        csvExt = ".csv"
        jsonExt = ".json"
        maxResults int64 = 200 // API results per page; highest supported value is 200
)

var (
        cliPtr *cliPtrStruct
        mutex = &sync.Mutex{}
        firstNodeColor = map[string]string{"background": "#7BE141"}
        otherNodeColor = map[string]string{"background": "#FFA807"}
        edgeColor = map[string]string{"color": "#D2D2D2"}
        nodes nodeArrStruct // full array fields for CSV
        // append data into here in preparation for parentsJSONStruct
        // subset of original array fields used for CSV
        nodeJSONArr []nodeJSONStruct 
        edgeObj edgeObjStruct // used to resolve nodes with multiple parents
        //edgeObj = make(edgeObjStruct) // used to resolve nodes with multiple parents (diamond pattern)
        edges edgeArrStruct
        grpArr []*admin.Group
        apiCallCount uint64 // use to iterate over service accounts to stay within quota
        // Hardcode the headers since getting struct fields via reflection
        // doesn't work with slices, and also need to get populated struct, ie. first record
        nodeHdrArr = []string{
                "ParentId",
                "Id", 
                "Label", 
                "Email",
                "DirectParentCount", 
                "IndirectParentCount",
                }
        searchHdrArr = []string{
                "Name",
                "Description",
                "Email",
                "Admin created",
                "Direct Members Count",
                }
        //scopeArr = []string{admin.AdminDirectoryGroupReadonlyScope, admin.AdminDirectoryGroupMemberReadonlyScope}
        scopeArr = []string{admin.AdminDirectoryGroupScope, admin.AdminDirectoryGroupMemberScope}
        authIdDescription = "group admin id"
)

func check(e error) {
    if e != nil {
        // use log.Panic instead of log.Fatal so deferred calls run
        // https://quasilyte.dev/blog/post/log-fatal-vs-log-panic/
        panic(e)
    }
}

func main() {

        app := cli.App("./groupCount", "List Groups and Count Parents") // first argument must match executable name
        app.Spec = "DOMAIN GRP_ADMIN_ID -p [-v SEARCH...] [-w]"
        // Define top-level global options   
        cliPtr = &cliPtrStruct{
                domain: app.StringArg("DOMAIN", "", "domain"),
                grpAdmin: app.StringArg("GRP_ADMIN_ID", "", authIdDescription),
                processType: app.StringOpt("p processType", "interact", "interact/batch: interactive web server or batch file output"), 
                visType: app.StringOpt("v visType", "", "parents/search: parent tree or search by prefix"),
                search: app.StringsArg("SEARCH", []string{""}, "parents: identity (user, service account, or group) whose parents to map, including domain suffix; search: group prefix for which to search"),
                wait: app.IntOpt("w wait", 0, "seconds each goroutine sleeps; set to 1 to prevent exceeding user queries per 100 seconds quota"),     
        }

        app.Before = func() {

                if *cliPtr.visType == "parents" && len(*cliPtr.search) == 0 {
                        log.Fatalf("Specify root identity for parent tree")
                }
                if *cliPtr.visType == "search" && len(*cliPtr.search) == 0 {
                        log.Fatalf("Specify search prefix for group list")
                } 
                edgeObj.obj = make(map[string]nodeResolutionStruct)
        }

        // Specify the action to execute when the app is invoked correctly
        app.Action = func() {
 
                if *cliPtr.processType == "interact" {
                        webServer()
                } else {
                        srvArr := newAdminDirectoryServiceArr(*cliPtr.grpAdmin)
                        if *cliPtr.visType == "parents" {                               
                                for _, search := range *cliPtr.search {  
                                        nodes.arr = nil
                                        nodeJSONArr = nil 
                                        edges.arr = nil
                                        fmt.Printf("Search %s\n", search) 
                                        createVisData(srvArr, *cliPtr.domain, search)
                                        writeVisData(search)
                                }
                        } else if *cliPtr.visType == "search" {
                                for _, search := range *cliPtr.search { 
                                        grpArr = nil 
                                        fmt.Printf("Search %s\n", search) 
                                        listGroupsByPrefix(srvArr, *cliPtr.domain, search)
                                        writeGroupsByPrefix(search)
                                }
                        }
                }                
        }
        
        app.Run(os.Args)        
}

// Based on https://www.alexedwards.net/blog/serving-static-sites-with-go
// with a bit of https://lets-go.alexedwards.net/sample/02.09-serving-static-files.html
// and https://golang.org/doc/articles/wiki/#tmp_14
func webServer() {
        var (
                fileServer http.Handler
        )
        // use mux instead of http.FileServer to support multiple routes
        mux := http.NewServeMux() 
 
        // Serve CSS, JS & Images statically
        fileServer = http.FileServer(http.Dir("./static/"))

        // Use the mux.Handle() function to register the file server as the handler for
        // all URL paths that start with "/static/". For matching paths, we strip the
        // "/static" prefix before the request reaches the file server.
        mux.Handle("/static/", http.StripPrefix("/static", fileServer))
        mux.Handle("/", http.StripPrefix("/", fileServer)) // index.html

        // Serve JSON files
        // This output redirect breaks the output writes 
        // So can't have webserver when writing files
        fileServer = http.FileServer(http.Dir("./output/"))
        mux.Handle("/output/", http.StripPrefix("/output", fileServer))

        // Serve API
        mux.HandleFunc("/api/parents/list", listParents)
        mux.HandleFunc("/api/search/list", listSearch)
        mux.HandleFunc("/api/cachedResponses/list", listCachedResponses)

        log.Println("Listening on :"+port+"...")
        portArr := []string{":",port}
        err := http.ListenAndServe(strings.Join(portArr,""), mux)
        if err != nil {
                log.Fatal(err)
        } 
}

func listCachedResponses(writer http.ResponseWriter, request *http.Request) {

        resp := cachedResponseStruct{
                                        CachedParentsArr: listCachedFiles(outputJSONParentsDir, parentsFileName), 
                                        CachedSearchArr: listCachedFiles(outputJSONSearchDir, searchFileName),
                                     }
        // https://thenewstack.io/make-a-restful-json-api-go/
        writer.Header().Set("Content-Type", "application/json; charset=UTF-8")
        writer.WriteHeader(http.StatusOK)
        if err := json.NewEncoder(writer).Encode(resp); err != nil {
                panic(err)
        }
}

func listCachedFiles(outputDir string, filePrefix string) []string {
        var (
                fileName string
                fileNameArr []string // array of split filename characters, not array of filenames
                fileArr []string 
        )

        cachedResponses, err := ioutil.ReadDir(outputDir)
        check(err)

        for _, file := range cachedResponses {
                fileName = strings.Split(file.Name(), filePrefix)[1] // remove prefix
                if len(fileName) > 0 {
                        // remove extension
                        // account for .json in filename prior to extension
                        fileNameArr = strings.Split(fileName,".json") 
                        if len(fileNameArr) > 0 {
                            fileNameArr = fileNameArr[:len(fileNameArr)-1]
                        }
                }
                fileName = strings.Join(fileNameArr,"")
                if fileName != "" {
                        fileArr = append(fileArr, fileName)   
                }              
        }
      
        return fileArr
}

/*func serveTemplate(writer http.ResponseWriter, request *http.Request) {

        templatePath := filepath.Join(templateDir, templateFile)

        tmpl, err := template.ParseFiles(templatePath)
        if err != nil {
                // Log the detailed error
                log.Println(err.Error())
                // Return a generic "Internal Server Error" message
                http.Error(writer, http.StatusText(500), 500)
                return
        }

        data := "Server config";
        // middle parameter must match {{define}} in template
        err = tmpl.ExecuteTemplate(writer, "vis", data) 

        if err != nil {
                log.Println(err.Error())
                http.Error(writer, http.StatusText(500), 500)
        }
}*/

func listParents(writer http.ResponseWriter, request *http.Request) {
        var (
                search string
                csvWriter *csv.Writer
                fileName string
        )
        err := request.ParseForm()
        if err != nil {
                //handle error http.Error() for example
                return
        }

        for key, valueArr := range request.Form {
                if key == "identity" {
                        if len(valueArr) > 0 { // there should be one and only one value
                                search = valueArr[0]
                                srvArr := newAdminDirectoryServiceArr(*cliPtr.grpAdmin)
                                nodes.arr = nil
                                nodeJSONArr = nil
                                edges.arr = nil
                                edgeObj.obj = make(map[string]nodeResolutionStruct)
                                createVisData(srvArr, *cliPtr.domain, search)
                                if len(nodes.arr) == 0 {
                                        // return empty object: no match
                                } else {
                                        csvWriter = nil                                
                                        populateNodeJSONArr(csvWriter)
                                        fileName = parentsFileName + search
                                        writeJSON(search, fileName, nodeJSONArr, edges.arr, nil)
                                        if nodeJSONArr == nil || edges.arr == nil {  
                                                http.Error(writer, http.StatusText(500), 500)
                                        } 
                                }                                      
                                resp := parentsJSONStruct{SearchIdentity: search, NodeArr: nodeJSONArr, EdgeArr: edges.arr}
                                // https://thenewstack.io/make-a-restful-json-api-go/
                                writer.Header().Set("Content-Type", "application/json; charset=UTF-8")
                                writer.WriteHeader(http.StatusOK)
                                if err := json.NewEncoder(writer).Encode(resp); err != nil {
                                        panic(err)
                                }

                                break;
                        }
                }
        }

}


func listSearch(writer http.ResponseWriter, request *http.Request) {
        var (
                search string
                fileName string
        )

        err := request.ParseForm()
        if err != nil {
                //handle error http.Error() for example
                return
        }

        for key, valueArr := range request.Form {
                if key == "prefix" {
                        if len(valueArr) > 0 { // there should be one and only one value
                                search = valueArr[0]
                                srvArr := newAdminDirectoryServiceArr(*cliPtr.grpAdmin)
                                grpArr = nil
                                listGroupsByPrefix(srvArr, *cliPtr.domain, search)
                                if len(grpArr) == 0 {
                                        // return empty object: no match
                                } else {
                                        fileName = searchFileName + search
                                        writeJSON(search, fileName, nil, nil, grpArr)
                                }
                                resp := searchJSONStruct{SearchPrefix: search, GroupArr: grpArr}
                                // https://thenewstack.io/make-a-restful-json-api-go/
                                writer.Header().Set("Content-Type", "application/json; charset=UTF-8")
                                writer.WriteHeader(http.StatusOK)
                                if err := json.NewEncoder(writer).Encode(resp); err != nil {
                                        panic(err)
                                }
                                break;
                        }
                }
        }
}


// Based on https://stackoverflow.com/questions/55867150/query-gsuite-directory-api-with-a-google-cloud-platform-service-account
// Use multiple services to stay within Admin SDK quota
func newAdminDirectoryServiceArr(grpAdminEmail string) []*admin.Service {
        var (
                srvArr []*admin.Service 
                globalErr error // thrown err only has scope within for loop
        )
        credentialFiles, err := ioutil.ReadDir(credentialDir)
        check(err)

        for _, file := range credentialFiles {
                jsonCredentials, err := ioutil.ReadFile(filepath.Join(credentialDir, file.Name()))
                if err != nil {
                        globalErr = err; // err only has scope within for loop                        
                } else {
                        config, _ := google.JWTConfigFromJSON(
                                        jsonCredentials,
                                        scopeArr...
                                        )
                        config.Subject = grpAdminEmail

                        ctx := context.Background()
                        client := config.Client(ctx)

                        srv, err := admin.New(client)
                        if err != nil {
                                globalErr = err; // err only has scope within for loop 
                        } else {
                                srvArr = append(srvArr, srv)
                        }
                } 
        }
        if globalErr != nil && len(srvArr) == 0 {
                log.Panic(globalErr) // log the last error
        } // else continue with those credentials which were successfully retrieved 
       
        return srvArr
}


func createVisData(srvArr []*admin.Service, grpDomain string, rootIdentity string) {

        var (
                visGrp int = 1 // root goes in group 1; this governs graph color 
                parentId int   
                nodeId int   
                // concurrent goroutines don't return values, so pass pointer to var
                indirectParentCount uint32 = 0
        )

        parentId = 0   // save before recursion so roots have lower numbers than branches
        nodeId = 0   // save before recursion so roots have lower numbers than branches
        addNode(visGrp, parentId, nodeId, grpDomain, strings.Split(rootIdentity,"@")[0], rootIdentity)
        getGroupsForIdentity(srvArr, grpDomain, parentId, rootIdentity, &indirectParentCount)

}


func getGroupsForIdentity(srvArr []*admin.Service, grpDomain string, parentId int, identity string, childIndirectParentCount *uint32) {

        var (
                srv *admin.Service
                nextPageToken string = ""  
                visGrp int = 2 // all nodes after root go in group 2; this governs graph color
                grpArr []*admin.Group  
                grpLen int
                nodeId int    
                // concurrent goroutines don't return values, so pass pointer to var 
                indirectParentCount uint32 = 0 
        )
        //go func doesn't accept & parameter, so assign pointer to placeholder
        indirectParentCountPtr := &indirectParentCount 
  
        // don't do initial group list concurrently with go routines or may exceed quota
        for {
                srv = getService(srvArr)
                r, err := srv.Groups.List().
                                Domain(grpDomain).
                                UserKey(identity).
                                MaxResults(maxResults).PageToken(nextPageToken). //MaxResults(10).
                                OrderBy("email").Do()
                if err != nil {
                        if gapiErr, ok := err.(*googleapi.Error); ok {
                               if gapiErr.Code == 500 { // internal error
                                        // retry once after 1 second: implement own retry since backoff libraries may not be threadsafe
                                        time.Sleep(time.Second)
                                        r, err = srv.Groups.List().
                                                        Domain(grpDomain).
                                                        UserKey(identity).
                                                        MaxResults(maxResults).PageToken(nextPageToken). //MaxResults(10).
                                                        OrderBy("email").Do()
                                        if err != nil {
                                                if gapiErr, ok := err.(*googleapi.Error); ok {
                                                        if gapiErr.Code == 403 { // authorization error
                                                                log.Fatalf("Is " + *cliPtr.grpAdmin + " the correct " + authIdDescription + "?",err);                                                           
                                                        } else if gapiErr.Code == 400 { // couldn't find group
                                                                // ignore
                                                        } else {
                                                              check(err)  
                                                        }
                                                } else {
                                                        check(err)
                                                }
                                        }
                                } else if gapiErr.Code == 403 { // authorization error
                                        log.Fatalf("Is " + *cliPtr.grpAdmin + " the correct " + authIdDescription + "?",err);                                                           
                                } else if gapiErr.Code == 400 { // couldn't find group
                                        // ignore
                                } else {
                                      check(err)  
                                }
                        }          
                } 
                if err != nil {
                        break
                } else {
                        grpArr = append(grpArr,r.Groups...)
                        nextPageToken = r.NextPageToken
                        if nextPageToken == "" {
                            break
                        }
                }
        }
        grpLen = len(grpArr)

        // https://golang.org/src/sync/example_test.go
        var wgChildren sync.WaitGroup // declare here so get new one for each recursion level
        for _, grp := range grpArr {                
                
                nodes.mu.RLock()
                nodeId = len(nodes.arr) // save before recursion so roots have lower numbers than branches
                nodes.mu.RUnlock()

                // https://www.alexedwards.net/blog/understanding-mutexes
                edgeObj.mu.Lock()
                if originalNodeObj, ok := edgeObj.obj[grp.Email]; ok {  
                        // map nodes with multiple parents as a diamond rather than separate branches               
                        nodeId = originalNodeObj.nodeId
                        addEdge(parentId, nodeId)
                        edgeObj.mu.Unlock()
                 } else {
                        edgeObj.obj[grp.Email] = nodeResolutionStruct{
                                                                parentId,
                                                                nodeId,
                                                                }
                        edgeObj.mu.Unlock()

                        addNode(visGrp, parentId, nodeId, grpDomain, grp.Name, grp.Email) 
                        if (nodeId != 0) { 
                                 addEdge(parentId, nodeId)
                        }

                        wgChildren.Add(1)
                        // pass in variables explicitly so they have correct scope or will null out
                        go func(srvArr []*admin.Service, grpDomain string, nodeId int, grpId string, indirectParentCountPtr *uint32) { 
                               // use defer wgChildren.Done() here if one of the child routines could error out before end of func
                  
                               getGroupsForIdentity(srvArr, grpDomain, nodeId, grpId, &indirectParentCount)
                                wgChildren.Done()

                        }(srvArr, grpDomain, nodeId, grp.Id, indirectParentCountPtr)

                        // prevent exceeding quota: limits to < 600 requests / 100 seconds
                        if *cliPtr.wait != 0 {
                            time.Sleep(time.Duration(*cliPtr.wait) * time.Second)
                        }
                }

        }  
        wgChildren.Wait()

        // just locking on the item can cause a read/append race with addNode
        // nodes.arr[parentId].mu.Lock() 
        nodes.mu.Lock()
        nodes.arr[parentId].directParentCount = grpLen
        nodes.arr[parentId].indirectParentCount = int(atomic.LoadUint32(&indirectParentCount))
        nodes.mu.Unlock()
        
        atomic.AddUint32(childIndirectParentCount, atomic.LoadUint32(&indirectParentCount) + uint32(grpLen))

}


func addNode(visGrp int, parentId int, nodeId int, grpDomain string, grpName string, grpEmail string) {
        var (
                nodeColor map[string]string
        )

        if (visGrp == 1) {                      
                nodeColor = firstNodeColor
        } else {
                nodeColor = otherNodeColor
        }
 
        nodes.mu.Lock()
        nodes.arr = append(nodes.arr,

                // initialize by name so don't have to init mutex
                nodeStruct{ 
                        parentId: parentId,
                        id: nodeId, // id
                        label: grpName, // label
                        email: grpEmail,
                        group: visGrp, // group: this is a vis.js group used to distinguish node types, not a Google group
                        color: nodeColor,   
                        clusterNode: false, // clusterNode
                        directParentCount: 0,
                        indirectParentCount: 0})
        
        nodes.mu.Unlock()            
}

func addEdge(parentId int, nodeId int) {
  
        edges.mu.Lock()
        edges.arr = append(edges.arr,
            edgeStruct{
                    parentId, // from
                    nodeId, // to
                    edgeColor, // color
            })  
        edges.mu.Unlock()              
}


func populateNodeJSONArr(csvWriter *csv.Writer) {
        for _, node := range nodes.arr {
                appendJSON(&node)
                if *cliPtr.processType == "batch" {
                        writeNodeCSV(csvWriter, &node)                                                
                } 
        }
}


func appendJSON(node *nodeStruct) {
       nodeJSONArr = append(nodeJSONArr,
                        nodeJSONStruct{
                                node.id, 
                                node.label,
                                node.group,
                                node.color,
                                node.clusterNode,
                                fmt.Sprintf("%s<ul><li>%d direct parents</li><li>%d indirect parents</li></ul>", node.email, node.directParentCount, node.indirectParentCount),
                                })
}


// https://golang.org/pkg/encoding/csv/#example_Writer
func writeNodeCSV(csvWriter *csv.Writer, node *nodeStruct) {

        record := []string{
                strconv.Itoa(node.parentId),
                strconv.Itoa(node.id), 
                node.label,
                node.email,
                strconv.Itoa(node.directParentCount), 
                strconv.Itoa(node.indirectParentCount),
        }
 
        if err := csvWriter.Write(record); err != nil {
                log.Fatalln("error writing record to node csv:", err)
        }
}


func listGroupsByPrefix(srvArr []*admin.Service, grpDomain string, grpPrefix string) {

        var (
                nextPageToken string = ""                                
        )
        
        // don't do initial group list concurrently with go routines or may exceed quota
        for {
                srv := getService(srvArr)
                r, err := srv.Groups.List().
                                Domain(grpDomain).
                                Query("email:{"+grpPrefix+"}*").
                                MaxResults(maxResults).PageToken(nextPageToken). //MaxResults(10).
                                OrderBy("email").Do()
                if err != nil {
                        if gapiErr, ok := err.(*googleapi.Error); ok {
                                if gapiErr.Code == 500 { // internal error
                                        // retry once after 1 second: implement own retry since backoff libraries may not be threadsafe
                                        time.Sleep(time.Second)
                                        r, err = srv.Groups.List().
                                                        Domain(grpDomain).
                                                        Query("email:{"+grpPrefix+"}*").
                                                        MaxResults(maxResults).PageToken(nextPageToken). //MaxResults(10).
                                                        OrderBy("email").Do()
                                        check(err)
                                } else {
                                        check(err)
                                }
                        }          
                } 

                grpArr = append(grpArr,r.Groups...)

                nextPageToken = r.NextPageToken
                if nextPageToken == "" {
                    break
                }
        }
}


// Use multiple service accounts to stay within quota
func getService(srvArr []*admin.Service) *admin.Service {
    var (
            srvIndex int
        )

    atomic.AddUint64(&apiCallCount, 1) // need to increment first since otherwise parallel go routines will use the same apiCallCount
    srvIndex = int(atomic.LoadUint64(&apiCallCount)) % int(len(srvArr)) // modulus
    
    return srvArr[srvIndex]
}


func writeVisData(search string) {
        var (
                    fileName string
                    nodeArrLen int
                    csvWriter *csv.Writer
            )

        // The webserver output redirect breaks the output writes 
        // So can't have webserver running when writing files

        fileName = parentsFileName + search
        removeFiles(outputJSONParentsDir, fileName)

        nodes.mu.RLock()
        nodeArrLen = len(nodes.arr)
        nodes.mu.RUnlock()
        if nodeArrLen == 0 {
                fmt.Printf("\nNo %s parent groups found for this identity %s\n", *cliPtr.domain, search)
                fmt.Print("\n")
        } else {
                fmt.Printf("\n%s has %d indirect parent groups on domain %s\n", search, nodes.arr[0].indirectParentCount, *cliPtr.domain)                       
                fmt.Print("\n")

                
                if *cliPtr.processType == "batch" { 
                        // can't encapsulate in function because defer is function scope
                        file, err := os.Create(filepath.Join(outputCSVDir, fileName+csvExt)) 
                        check(err)
                        defer file.Close()
                        csvWriter = csv.NewWriter(file)
                        writeHdr(csvWriter, "parents")
                }

                populateNodeJSONArr(csvWriter) 
                
                if *cliPtr.processType == "batch" {
                        writeJSON(search, fileName, nodeJSONArr, edges.arr, nil)
                        flushCSV(csvWriter)
                } 
        }

        fmt.Print("\n")

}

func writeGroupsByPrefix(search string) {
        var (
                    fileName string
                    csvWriter *csv.Writer
            )

        fileName = searchFileName + search
        removeFiles(outputJSONSearchDir, fileName)
        grpLen := len(grpArr)
        if grpLen == 0 {
                fmt.Printf("\nNo %s groups found with prefix '%s'\n", *cliPtr.domain, search)
        } else {
                fmt.Printf("\nDomain %s has %d groups with prefix '%s'\n", *cliPtr.domain, grpLen, search)
                fmt.Print("\n")

                if *cliPtr.processType == "batch" {
                        // can't encapsulate in function because defer is function scope
                        //fileName = searchFileName + *cliPtr.search 
                        file, err := os.Create(filepath.Join(outputCSVDir, fileName+csvExt)) 
                        check(err)
                        defer file.Close()
                        csvWriter = csv.NewWriter(file)
                        writeHdr(csvWriter, "search")
                }

                for _, grp := range grpArr {                                        
                        if *cliPtr.processType == "batch" {
                                writeSearchCSV(csvWriter, grp)
                        }
                }

                if *cliPtr.processType == "batch" {  
                        writeJSON(search, fileName, nil, nil, grpArr)
                        flushCSV(csvWriter)
                } 

                fmt.Print("\n")
        }
}


func removeFiles(outputJSONDir string, fileName string) {
 
        _ = os.Remove(filepath.Join(outputJSONDir, fileName+jsonExt)) 
        _ = os.Remove(filepath.Join(outputCSVDir, fileName+csvExt)) 
}

// https://golang.org/pkg/encoding/csv/#example_Writer
func writeHdr(csvWriter *csv.Writer, visType string) {
        var (
                hdrArr []string
        )

        if visType == "parents" {
                hdrArr = nodeHdrArr

        } else { // search
                hdrArr = searchHdrArr
        }

        if err := csvWriter.Write(hdrArr); err != nil {
                log.Fatalln("error writing record to csv:", err)
        }
}

// Can't pass in array as interface because have to convert individual elements
func writeJSON(search string, fileName string, nodeArr []nodeJSONStruct, edgeArr []edgeStruct, searchArr []*admin.Group) {
        var (
                jsonFile *os.File
                encoder *json.Encoder
        )

        if nodeArr != nil && edges.arr != nil {
                jsonFile = createJSONFile(outputJSONParentsDir, fileName)
                defer jsonFile.Close() 

                // https://medium.com/eaciit-engineering/better-way-to-read-and-write-json-file-in-golang-9d575b7254f2 
                // also https://www.golangprograms.com/golang-writing-struct-to-json-file.html
                encoder = json.NewEncoder(jsonFile)
                encoder.Encode(parentsJSONStruct{SearchIdentity: search, NodeArr: nodeArr, EdgeArr: edgeArr})

        } else if searchArr != nil {
                jsonFile = createJSONFile(outputJSONSearchDir, fileName)
                defer jsonFile.Close() 

                // https://medium.com/eaciit-engineering/better-way-to-read-and-write-json-file-in-golang-9d575b7254f2 
                // also https://www.golangprograms.com/golang-writing-struct-to-json-file.html
                encoder = json.NewEncoder(jsonFile)
                encoder.Encode(searchJSONStruct{SearchPrefix: search, GroupArr: searchArr})
        }
}


// can't pass arrays of different structs to function: https://stackoverflow.com/questions/7975095/pass-string-slice-to-variadic-empty-interface-parameter/7975763#7975763
// so just return file
func createJSONFile (outputDir string, fileName string) *os.File {

        file, err := os.Create(filepath.Join(outputDir, fileName+jsonExt)) 
        check(err)        

        return file
}



func writeSearchCSV (csvWriter *csv.Writer, group *admin.Group) {

        record := []string{
                        group.Name,
                        group.Description,
                        group.Email,
                        strconv.FormatBool(group.AdminCreated),
                        strconv.FormatInt(group.DirectMembersCount,10),
                        }

        if err := csvWriter.Write(record); err != nil {
                log.Fatalln("error writing record to search csv:", err)
        }
}

func flushCSV (csvWriter *csv.Writer) {
        // https://golang.org/pkg/encoding/csv/#example_Writer
        // Write any buffered data to the underlying writer
        csvWriter.Flush()

        if err := csvWriter.Error(); err != nil {
                log.Panic(err)
        }
}

