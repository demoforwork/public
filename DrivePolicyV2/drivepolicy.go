package main

import (
    "oauth" // from https://github.com/demoforwork/public/tree/master/oauth
    
    "bytes"
    "encoding/base64"
    "encoding/json"
    "errors"
    "fmt"
    "html/template" // same interface as text/template package but automatically secures HTML output against certain attack
    "io/ioutil"
    "log"
    "os"
    "reflect"
    "strings"
    "sync"
    "sync/atomic" // for int64 apiCallCount
    "time"

    "github.com/jawher/mow.cli"
    
    "cloud.google.com/go/logging" // Stackdriver logging client package

    "golang.org/x/oauth2/google"
    "golang.org/x/oauth2"
    // v3 Drive API doesn't include domain in the permissions returned by File list for non-domain shares, 
    // so have to parse the email address
    // v3, unlike v2, doesn't return permissions for files for which user running utility only has read permissions
    "google.golang.org/api/drive/v2"
    "google.golang.org/api/gmail/v1"
    "google.golang.org/api/sheets/v4"
    
    "golang.org/x/net/context"  // for Stackdriver logging OAuth
    "google.golang.org/api/option" // for Stackdriver logging OAuth
    "google.golang.org/api/googleapi" // for error.Code
)

type cliPtrStruct struct {
    subject *string
    mailTo *string 
    policySpreadsheetId *string 
    rootId *string
    itemType *string
    fix *bool
    wait *int
}

type flagStruct struct {
    Flag string
    FlagVal string
}

type itemWithPolicyStruct struct {   
    // Enable performant search via map since golang doesn't have array search
    // https://stackoverflow.com/questions/10485743/contains-method-for-a-slice
    item *drive.File
    permittedDomainMap map[string]struct{}
}

type permissionStruct struct {
    // Variables must be upper-case so they're exportable and available in the template
    Role string
    Response string
}

type notificationStruct struct {
    // Enable templates 
    // Variables must be upper-case so they're exportable and available in the template   
    Name string
    Url string
    ItemType string 
    OwnerMap map[string]string  
    PermittedDomainMap map[string]struct{}
    PermissionMap map[string]*permissionStruct
}

type notificationTemplate struct {
    // Variables must be upper-case so they're exportable and available in the template
    Header string
    FlagArr []*flagStruct
    FolderPolicyArr []*folderPolicyStruct
    LogArr []string
    NotificationMap map[string]*notificationStruct
}

type folderPolicyStruct struct {
    Id string
    Name string
    Domain string
}

const (
    // declaring type is optional for constants
    oAuthCredentialFile = "credentials.json"
    policyRange = "PolicyRange" // spreadsheet range name
    logName = "drivepolicy" // name for Stackdriver log... not clear where this is surfaced
    pageSize int64 = 1000
    sleepSeconds = 1 
    folderMimeType = "application/vnd.google-apps.folder"   
    fatal = "Fatal"
    warning = "Warning"
    info = "Info"
    tokenFile = "token.json" 
    driveScope = drive.DriveScope
    mailScope = gmail.GmailSendScope 
)

// Global options available to any of the commands
// Need to set these here so they're available in app.Before, app.After as well as within the app.Commands
var (  
    // maps and arrays can't be constants: https://stackoverflow.com/questions/18342195/how-to-declare-constant-map   
    
    apiVersion string
    // If modifying these scopes, delete previously saved token.json
    scopeArr = []string{sheets.SpreadsheetsReadonlyScope, drive.DriveMetadataReadonlyScope, logging.WriteScope}
    
    mailHeader = map[string]string{"Subject": "",
                                    "MIME-Version": "1.0",
                                    "Content-Type": "text/html",
                                    "Content-Transfer_Encoding": "quoted-printable"}
    templatesArr = []string{"templates/layout.html","templates/flags.html","templates/policy.html","templates/logs.html","templates/permissions.html"}

    folderPolicyArr []*folderPolicyStruct // to show policy in order in email
    folderPolicyMap = make(map[string]string) // to search policy by folder id
    
    // use struct instead of interface or get cast errors on arrays within it
    // use pointer to struct or get errors on append of arrays within it since not addressable
    // https://stackoverflow.com/questions/32751537/why-do-i-get-a-cannot-assign-error-when-setting-value-to-a-struct-as-a-value-i                                        
    itemWithPolicyMap = make(map[string]*itemWithPolicyStruct)  
    notificationMap = make(map[string]*notificationStruct) 
    logArr []string
    templateStruct *notificationTemplate
    rootFolder *drive.File
    cliPtr *cliPtrStruct
    //teamDrivePtr *bool
    sheetsService *sheets.Service
    driveService *drive.Service
    gmailService *gmail.Service
    logService *logging.Client
    logInfo *log.Logger
    logWarning *log.Logger
    logCritical *log.Logger

    mutex = &sync.Mutex{}
    
    moreFiles bool
    apiCallCount uint64

)


func main() {
    app := cli.App("./drivepolicy", "Drive Policy Validator and Fixer") // first argument must match executable name
    app.Spec = "[-s] [-m] -p -r [-i] [-f] [-w]"
    // Define top-level global options   
    cliPtr = &cliPtrStruct{
        subject: app.StringOpt("s subject", "Out of Policy Drive Shares", "Email subject and title"),
        mailTo: app.StringOpt("m mailTo", "", "mailTo addressee"),
        policySpreadsheetId: app.StringOpt("p policySpreadsheetId", "", "Policy spreadsheet id"), 
        rootId: app.StringOpt("r rootId", "", "root folder id"), //  or team drive name
        itemType: app.StringOpt("i itemType", "both", "file/folder/both: which type of items to validate or fix"),
        fix: app.BoolOpt("f fix", false, "fix permissions"),
        wait: app.IntOpt("w wait", 0, "seconds each goroutine sleeps; set to 1 to prevent exceeding user queries per 100 seconds quota prior to applying for increase to 10k from default 1k: https://support.google.com/code/contact/drive_quota"),     
    }

    app.Before = func() {

        var (
            //https://stackoverflow.com/questions/37747370/golang-how-can-i-write-a-map-which-is-mixed-with-string-and-array
            credentialMap map[string]interface{}
            sheetRespValuesArr [][]interface{}
            folderName string
            )

        if *cliPtr.mailTo != "" {
            scopeArr = append(scopeArr,mailScope)
        }
        if *cliPtr.fix {
            scopeArr = append(scopeArr,driveScope)
        }

        byt, err := ioutil.ReadFile(oAuthCredentialFile)
        if err != nil {
            log.Fatalf("Unable to read client secret file: %v", err)
        }       

        config, err := google.ConfigFromJSON(byt, scopeArr...)
        if err != nil {
            log.Fatalf("Unable to parse client secret file to config: %v", err)
        }
        client := oauth.GetClient(config)


        // get project id 
        if err := json.Unmarshal(byt, &credentialMap); err != nil {
            log.Fatalf("Unable to parse credential file %v", err)
        } else {
            projectId := credentialMap["installed"].(map[string]interface{})["project_id"]
            
            // Get context and service account credential file path from GOOGLE_APPLICATION_CREDENTIALS environment variable
            // The following statement just initializes the context service
            ctx := context.Background()
            // Create a client
            //logService, err = logging.NewClient(ctx, projectId.(string))
            //cfg, err := google.ConfigFromJSON(byt, "https://logging.googleapis.com/v2/entries:write")
            //tokenSrc, err := google.DefaultTokenSource(oauth2.NoContext, oauthsvc.UserinfoEmailScope)
            token, err := tokenFromFile(tokenFile)
            if err != nil {
                log.Fatalf("Unable to get token from file %s: %v", err)
            } else {
                // Based on https://www.jkawamoto.info/blogs/use-access-token-from-google-cloud-go/
                // Stackdriver examples are based on service account credential file:                
                // https://cloud.google.com/logging/docs/setup/go
                // logService, err := logging.NewClient(ctx, projectId.(string), option.WithCredentials(creds))
                // but we want to leverage the Drive & Gmail OAuth token 

                logService, err = logging.NewClient(ctx, projectId.(string), option.WithTokenSource(config.TokenSource(ctx, token)))
                if err != nil {
                        log.Fatalf("Unable to create Stackdriver client: %v", err)
                } else { 
                    logInfo = logService.Logger(logName).StandardLogger(logging.Info)
                    logWarning = logService.Logger(logName).StandardLogger(logging.Warning)
                    logCritical = logService.Logger(logName).StandardLogger(logging.Critical)

                    sheetsService, err = sheets.New(client)
                    if err != nil {
                        logIt(err, "Unable to create Sheets client", fatal)  
                    } else {
                        sheetRespValuesArr, err = getSheetData(sheetsService, *cliPtr.policySpreadsheetId, policyRange)
                        if err != nil {
                            logIt(err, "Unable to retrieve policy from Sheets", fatal)
                        } else {
                            // need in array form to show in order in mail
                            folderPolicyArr = getPolicyArr(sheetRespValuesArr)
                            driveService, err = drive.New(client)
                            if err != nil {
                                logIt(err, "Unable to create Drive client", fatal)
                            } else {
                                
                                // Get policy folder names
                                // folderPolicyMap map[string]map[string]string
                                for index, folder := range folderPolicyArr {

                                    // need in map form to search by folder id 
                                    folderPolicyMap[folder.Id] = folder.Domain

                                    item, err := driveService.Files.Get(folder.Id).Do()
                                    if err != nil {
                                        folderName = "Unable to get folder: " + err.Error()
                                    } else {                       
                                        if item.MimeType != folderMimeType {
                                            folderName = "Please specify a folder Id; this is a file Id: " + folder.Id  
                                            logIt(err, folderName, warning)
                                        } else {
                                            folderName = item.Title
                                            // v3 folderName = item.Name 
                                        }
                                    }
                                    folderPolicyArr[index].Name = folderName
                                }
                                gmailService, err = gmail.New(client)
                                if err != nil {
                                    logIt(err, "Unable to retrieve Gmail client", fatal)
                                }
                            }
                        }
                    }
                }
            }
        }           
    }

    // Specify the action to execute when the app is invoked correctly
    app.Action = func() {

        var (
            permittedDomainMap = make(map[string]struct{})                 
        )

        item, err := driveService.Files.Get(*cliPtr.rootId).Do()
        // v3 item, err := driveService.Files.Get(*cliPtr.rootId).Fields("id","mimeType","trashed").Do() 
        if err != nil {
           logIt(err, "Unable to get folder", fatal)
        } else {                       
            if item.MimeType != folderMimeType {
              logIt(err, "Please specify a folder Id; this is a file Id: " + *cliPtr.rootId + " " + item.MimeType, fatal) 
              
            } else {
                if item.Labels.Trashed {
                // v3 if item.Trashed {
                    logIt(err, "Please specify an active folder; this folder is trashed: " + *cliPtr.rootId, fatal) 
                } else {
                    rootFolder := item
                    if _, ok := folderPolicyMap[item.Id]; ok { // https://stackoverflow.com/questions/2050391/how-to-check-if-a-map-contains-a-key-in-go
                        permittedDomainMap[folderPolicyMap[item.Id]] = struct{}{}
                    }
                    folderPermissions(rootFolder, permittedDomainMap)
                }
            }
        }
          
    }

    app.After = func() {

        apiCallCount := atomic.LoadUint64(&apiCallCount)
        logIt(nil, fmt.Sprintf("%s %d","API Call Count: ", apiCallCount), info)

        // Validate permissions against policy
        mutex.Lock()
        validatePermissions(itemWithPolicyMap)
        mutex.Unlock()

        if *cliPtr.mailTo != "" {
            mailHeader["To"] = *cliPtr.mailTo
            mailHeader["Subject"] = *cliPtr.subject
            sendMailFromTemplate(mailHeader, folderPolicyArr, logArr, notificationMap)
        }
        logService.Close()
    }

    app.Run(os.Args)        
}


// From go oauth package
// Retrieves a token from a local file.
func tokenFromFile(file string) (*oauth2.Token, error) {
    f, err := os.Open(file)
    if err != nil {
            return nil, err
    }
    defer f.Close()
    tok := &oauth2.Token{}
    err = json.NewDecoder(f).Decode(tok)
    return tok, err
}

func folderPermissions(folder *drive.File, permittedDomainMap map[string]struct{}) {
       
    var (
        fileArr []*drive.File
        nextPageToken  string = ""  
        itemPermittedDomainMap map[string]struct{}            
    )

    //get files in folder

    // don't do initial file read concurrently with go routines or will exceed quota
    // var wgFiles sync.WaitGroup // declare here so get new one for each recursion level
    // moreFiles = true
    for {
        //wgFiles.Add(1)
        //go func() {
        qArr := []string{"'",folder.Id,"' in parents and trashed = false"}
        qString := strings.Join(qArr,"")
        atomic.AddUint64(&apiCallCount, 1)
        r, err := driveService.Files.List().Q(qString).PageToken(nextPageToken). 
                        MaxResults(pageSize).Fields("nextPageToken, items(id, title, mimeType, labels, alternateLink, owners, permissions)").Do()
                        // v3 PageSize(pageSize).Fields("nextPageToken, files(id, name, mimeType, webViewLink, owners, permissions)").Do()
        if err != nil {
            if gapiErr, ok := err.(*googleapi.Error); ok {
                if gapiErr.Code == 500 { // internal error
                    // retry once after 1 second: implement own retry since backoff libraries may not be threadsafe
                    time.Sleep(time.Second)
                    atomic.AddUint64(&apiCallCount, 1)
                    r, err = driveService.Files.List().Q(qString).PageToken(nextPageToken).  
                                MaxResults(pageSize).Fields("nextPageToken, items(id, title, mimeType, labels, alternateLink, owners, permissions)").Do()
                                // v3 PageSize(pageSize).Fields("nextPageToken, files(id, name, mimeType, webViewLink, owners, permissions)").Do()
                } 
            }          
        } 
        if err != nil {
            logIt(err, "Unable to list files in folder " + folder.Id + "; ", warning)
            /*mutex.Lock()
            moreFiles = false
            mutex.Unlock()*/
            break
        }
        
        //mutex.Lock()
        fileArr = append(fileArr,r.Items...)
        // v3 fileArr = append(fileArr,r.Files...)
        //mutex.Unlock()
        nextPageToken = r.NextPageToken
        if nextPageToken == "" {
            /*mutex.Lock()
            moreFiles = false
            mutex.Unlock()*/
            break
        }

        //wgFiles.Done()
        //}()
    }
    //wgFiles.Wait()
    //}
       
    
    // https://golang.org/src/sync/example_test.go
    var wgChildren sync.WaitGroup // declare here so get new one for each recursion level
    for _, item := range fileArr {

        mutex.Lock()
        // set local tree of permitted domains for each item separately
        // otherwise aggregate across items
        itemPermittedDomainMap = make(map[string]struct{}) 
        for domain, _ := range permittedDomainMap {
           itemPermittedDomainMap[domain] = struct{}{}
        }

        // add permitted domains for current folder
        if item.MimeType == folderMimeType {
            if _, ok := folderPolicyMap[item.Id]; ok { // https://stackoverflow.com/questions/2050391/how-to-check-if-a-map-contains-a-key-in-go
                // need to do this before call go routine to avoid it pushing up the stack
                itemPermittedDomainMap[folderPolicyMap[item.Id]] = struct{}{}
            }
        }
       

        wgChildren.Add(1)
        // go validateChildren(folderId, permittedDomainMap, fileArr)
        // pass in variables explicitly so they have correct scope or will null out
        go func(item *drive.File, permittedDomainMap map[string]struct{}) { 
            // permittedDomainMap has local scope since golang doesn't have pass by reference. even for maps
            // use defer wgChildren.Done() here if one of the child routines could error out before end of func
            
            if item.MimeType == folderMimeType {
                folderPermissions(item, permittedDomainMap)
            }
              
            wgChildren.Done()
        }(item, itemPermittedDomainMap)

        // do this after have already incremented the permissions  
        // and before call async goroutines which could change permittedDomainMap up the tree by reference           
        //validatePermissions(item, permittedDomainMap) 
        //validatePermissions(item, itemPermittedDomainMap) 
        upsertItemDetail(item, itemPermittedDomainMap) 
        mutex.Unlock()

        // prevent exceeding 1k requests per user per 100 seconds quota: limits to < 600 requests / 100 seconds
        if *cliPtr.wait != 0 {
            time.Sleep(time.Duration(*cliPtr.wait) * time.Second)
        }

    }
    wgChildren.Wait()
        
}

// Accumulate prior to validation since a file/folder with multiple parents 
// may have valid permittedDomains on one of the parent's ancestors which then apply to the file/folder
// even though it doesn't have them on the other parent's ancestors.
func upsertItemDetail(item *drive.File, permittedDomainMap map[string]struct{}) {

    var (      
        id string = item.Id  
    )

    _, itemWithPolicyMapExists := itemWithPolicyMap[id]
    if !itemWithPolicyMapExists {
        itemWithPolicyMap[id] = &itemWithPolicyStruct{item, permittedDomainMap}   
    } else {
        for domain, _ := range permittedDomainMap {
            itemWithPolicyMap[id].permittedDomainMap[domain] = struct{}{}
        } 
    }  

}

func validatePermissions(itemWithPolicyMapLocal map[string]*itemWithPolicyStruct) {

    var ( 
        public bool
        isFolder bool
        domainMatch bool
        item *drive.File
        itemType string        
        ownerMap map[string]string
        permissionMap map[string]*permissionStruct
        permittedDomainMap map[string]struct{}
        emailAddress string
        emailAddressArr []string
        domain string
        // permissionMap = make(map[string]string)
        response string
        )

    for itemId, itemWithPolicy := range itemWithPolicyMapLocal {

        item = itemWithPolicy.item
        ownerMap = make(map[string]string)
        permittedDomainMap = itemWithPolicy.permittedDomainMap
        permissionMap = make(map[string]*permissionStruct)

        _, public = permittedDomainMap["public"]

        for _, permission := range item.Permissions {

            if permission.Deleted != true {

                if item.MimeType == folderMimeType {
                    isFolder = true
                    itemType = "Folder"
                } else {
                    isFolder = false
                    itemType = "File"
                }
                
                if permission.Type == "domain" {                  
                    domain = permission.Domain
                } else {
                    // v3 Drive API doesn't include domain in the permissions returned by File list unless the file is domain-shared
                    // More performant to parse the email address than to get the permission
                    emailAddressArr = strings.Split(permission.EmailAddress,"@")
                    if len(emailAddressArr) < 2  {     
                        domain = ""
                        logIt(nil, "Unable to get domain from permission email for itemId: " + itemId + "; type: " + permission.Type + "; emailAddress: " + permission.EmailAddress, warning)
                    } else {
                        domain = emailAddressArr[1]
                    }
                }
                _, domainMatch = permittedDomainMap[domain]
                

                if !domainMatch && !public &&
                    (*cliPtr.itemType == "both" || 
                    (*cliPtr.itemType == "folder" && isFolder || *cliPtr.itemType == "file" && !isFolder))  {
                    
                    switch permission.Type {
                    case "user":
                        emailAddress = permission.EmailAddress
                    case "group":
                        emailAddress = permission.EmailAddress
                    case "domain":
                        emailAddress = permission.Domain
                    case "anyone":
                        emailAddress = permission.Id
                    default:
                        emailAddress = permission.Type
                    }

                    if *cliPtr.fix {
                        response = fixPermission(item, itemType, permission, emailAddress)
                    } else {
                        response = ""
                    }
                    if *cliPtr.mailTo != "" {

                        _, notificationMapExists := notificationMap[itemId]

                        if notificationMapExists {  
                            notificationMap[itemId].PermissionMap[permission.EmailAddress] = &permissionStruct{permission.Role, response}
                        } else {
                             
                            for _, owner := range item.Owners {
                                ownerMap[owner.EmailAddress] = owner.DisplayName
                            }

                            permissionMap[emailAddress] = &permissionStruct{permission.Role, response}
                            
                            notificationMap[itemId] = &notificationStruct{   
                                                    item.Title,                                                              
                                                    // v3 item.Name,    
                                                    item.AlternateLink,                                          
                                                    // v3 item.WebViewLink, 
                                                    itemType, 
                                                    ownerMap,
                                                    permittedDomainMap,
                                                    permissionMap,
                                                }
                        }
                        
                    }
                }                   
            }
        }
    }
}

func fixPermission(item *drive.File, itemType string, permission *drive.Permission, emailAddress string) string {

  err := driveService.Permissions.Delete(item.Id, permission.Id).Do()
  if err != nil {
    logIt(err, fmt.Sprintf("Unable to delete permission %s: %s from %s %s (%s)", 
        emailAddress, 
        permission.Role,
        itemType, 
        item.Title,       
        // v3 item.Name, 
        item.Id),
        warning)
    return "Failure"
  }
  return "Success"
}


func getSheetData(sheetsService *sheets.Service, spreadsheetId string, readRange string) ([][]interface{}, error) {

    resp, err := sheetsService.Spreadsheets.Values.Get(spreadsheetId, readRange).Do()
    if err != nil {
        return nil, err
    } else {
        if len(resp.Values) == 0 {
            return resp.Values, errors.New("No data found in sheet range")
        } else {
            return resp.Values, nil
        }
    }      
}

func getPolicyArr(sheetRespValues [][]interface{}) []*folderPolicyStruct {
    var (
        id string
        domain string
        policyArr []*folderPolicyStruct
        )
    
    for index, row := range sheetRespValues {
        if index > 0 { // skip header
            id = row[0].(string)
            domain = row[1].(string)
            policyArr = append(policyArr,
                &folderPolicyStruct{
                    id, 
                    "",  //name
                    domain})
        }
    }

    return policyArr
}

func parseTemplate(data *notificationTemplate) (string, error) {
    var body string
    // Pass array into variadic function: https://blog.learngoprogramming.com/golang-variadic-funcs-how-to-patterns-369408f19085
    t, err := template.ParseFiles(templatesArr...) 
    if err == nil {
        buffer := new(bytes.Buffer)
        if err = t.Execute(buffer, data); err == nil {
            body = buffer.String()
        }
    }
    
    return body, err
}

// Sending html emails: http://www.blog.labouardy.com/sending-html-email-using-go/
//func sendMailFromTemplate(mailHeader map[string]string, cliPtr *cliPtrStruct, folderPolicyWithNameMap map[string]map[string]string, logArr []string, notificationMap map[string]*notificationStruct) {
func sendMailFromTemplate(mailHeader map[string]string, folderPolicyArr []*folderPolicyStruct, logArr []string, notificationMap map[string]*notificationStruct) {

    //type flagStruct map[string]string
    var ( 
        // use an array to retain order
        flagArr []*flagStruct
        flag string
        flagVal string
        )

    // Reflection: 
    // - https://stackoverflow.com/questions/23350173/how-do-you-loop-through-the-fields-in-a-golang-struct-to-get-and-set-values-in-a 
    // - https://play.golang.org/p/UKFMBxfbZD
    // Can't use the following simpler approach without making the Struct fields exportable
    // https://stackoverflow.com/questions/18926303/iterate-through-the-fields-of-a-struct-in-go
    cliPtrReflect := reflect.ValueOf(cliPtr).Elem()
    typeOfCliPtr := cliPtrReflect.Type()

    for i := 0; i < cliPtrReflect.NumField(); i++ {
        f := cliPtrReflect.Field(i)
            flag = typeOfCliPtr.Field(i).Name
            flagVal = fmt.Sprintf("%v",reflect.Value(f).Elem())
            flagArr = append(flagArr, &flagStruct{flag, 
                                                flagVal})         
    }

    templateStruct = &notificationTemplate{
            *cliPtr.subject, 
            flagArr,
            folderPolicyArr,
            logArr,
            notificationMap,
        }
    body, err := parseTemplate(templateStruct) 
    
    if err != nil {
        logIt(err, "Unable to parse template", fatal)
    } else { 
        err := sendMail(mailHeader, body) 
        if err != nil {
            logIt(err, "Unable to send email", fatal)        
        }
    } 
}


// https://github.com/uttamgandhi24/send-gmail/blob/master/send_gmail.go
// For alternative mail package to simplify this and support attachments, see https://github.com/jordan-wright/email
func sendMail(mailHeader map[string]string, body string) error {

    var msg string
    for k, v := range mailHeader {
        msg += k + ": " + v +"\r\n"
    }

    msg += "\r\n" + body

    var gMsg gmail.Message
    gMsg.Raw = base64.StdEncoding.EncodeToString([]byte(msg))
    // Need the following to cleanup complex HTML: 
    // https://stackoverflow.com/questions/37523884/send-email-with-attachment-using-gmail-api-in-golang
    gMsg.Raw = strings.Replace(gMsg.Raw, "/", "_", -1)
    gMsg.Raw = strings.Replace(gMsg.Raw, "+", "-", -1)
    gMsg.Raw = strings.Replace(gMsg.Raw, "=", "", -1)

    _, err := gmailService.Users.Messages.Send("me", &gMsg).Do()

    return err
}

func logIt(err error, msg string, logLevel string) { 

    // Provide guidance for errors caused by token with insufficient scope
    if err != nil {
        if gapiErr, ok := err.(*googleapi.Error); ok {
            if gapiErr.Code == 403 {
                // concat more efficient than fmt.Sprintf: 
                // https://gist.github.com/dtjm/c6ebc86abe7515c988ec
                msg += "; delete token.json and re-run - " + err.Error() 
            } else {
                msg += " - " + err.Error()
            }
        } else {
            msg += " - " + err.Error() 
        }  
    }  

    // Email
    logArr = append(logArr, msg)
    switch logLevel {
    case fatal:       
        logCritical.Println(msg) // Log to Stackdriver before terminating shell
        logService.Close() // Close Stackdriver service before terminating shell
        log.Fatalln(msg) // shell
    case warning:
        logWarning.Println(msg)
        log.Println(msg) 
    case info:
        logInfo.Println(msg)
        log.Println(msg)       
    default:       
        logInfo.Println(msg) 
        log.Println(msg)
    }
}
