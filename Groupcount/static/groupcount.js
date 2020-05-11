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

var data;
var cachedParentsArr;
var cachedSearchArr;

var nodes = null;
var edges = null;
var network = null;

var clusterIndex = 0;
var clusters = [];
var lastClusterZoomLevel = 0;
var clusterFactor = 0.9;
var progressBarInterval = 20;

var parentsOutputPath = "../output/JSON/parents/";
var searchOutputPath = "../output/JSON/search/"

function incrementProgress() {
  var value = $('progress').val(); 
  $('progress').val(++value % 101);
}
function stopProgress() {

}

function destroy() {
    if (network !== null) {
        network.destroy();
        network = null;
    }
}

/**
 * Store state in persistent way
 * http://stackoverflow.com/questions/10452604/keeping-variable-alive-in-a-javascript-function
 *
 * State DOES NOT PERSIST through html service callback: it's running in separate context.
 */
var stateModule = (function() {
  // private Variables
  var graphType; 

  // public object - returned at end of module
  var pub = {};

  pub.setGraphType = function(newState) {
    graphType = newState;
  };

  pub.getGraphType = function() {
    return graphType;
  };

  return pub; // expose externally
}());

// https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
// pass in callback function as success argument
function loadJSON(path, success) {
  $('#error').text("");
  const myRequest = new Request(path);
  fetch(myRequest) 
  .then(response => { // returns data, which is used in next .then's chaining
     const contentType = response.headers.get('content-type');
     if (!contentType || !contentType.includes('application/json')) {
       throw new Error("No matching cached graphs or searches");
     }
     return response.json();
  })
  .then(data => success(data))
  .catch(error => errorHandler(error)); 
}

function errorHandler(error) {
    $('#parents-progress-bar').addClass('hidden');
    $('#search-progress-bar').addClass('hidden');
    if (error == "TypeError: Failed to fetch") {
        error = "No matching groups"
    }
    $('#error').text(error)
}

function loadCachedFiles() {
    loadJSON("../api/cachedResponses/list", onCachedResponsesLoad);
}

function onCachedResponsesLoad(cachedResponsesObj) {
    $('#parents-progress-bar').addClass('hidden');
    $('#search-progress-bar').addClass('hidden');
    cachedParentsArr = [];
    cachedSearchArr = [];
    if (cachedResponsesObj.CachedParentsArr) {
        cachedParentsArr = cachedResponsesObj.CachedParentsArr;
        // Select2 doesn't fire if there isn't an alternative entry
        cachedParentsArr.push('None Selected');    
    }
    if (cachedResponsesObj.CachedSearchArr) {
        cachedSearchArr = cachedResponsesObj.CachedSearchArr;
        // Select2 doesn't fire if there isn't an alternative entry
        cachedSearchArr.push('None Selected');
    }    

    var optionsAsString = getOptions(cachedParentsArr);
    $("select[name='parents-files']").find('option').remove().end().append($(optionsAsString));
    var optionsAsString = getOptions(cachedSearchArr);
    $("select[name='search-files']").find('option').remove().end().append($(optionsAsString));
}

function getOptions(optionsArr) {
    var optionsAsString = '';
    var len = optionsArr.length;
    for (var i = len; i--;) {
      optionsAsString += "<option>" + optionsArr[i] + '</option>';
    }
    return optionsAsString;
}

function simulate() {
        
    $('#error').text("");
    $('#identity').val("");
    $('#parents-files').val(""); // Select the option 
    $('#parents-files').trigger('change'); // Notify any JS components that the value changed   
    var nodeCount = document.getElementById('node-count').value;
    // randomly create some nodes and edges
    data = getScaleFreeNetwork(nodeCount)
    simulationData = data;
    // simulated graph and parent graph are inverted in their node representation
    // so invert when load other type
    if (stateModule.getGraphType() != "simulate") {
        invertTree()
    }
    stateModule.setGraphType('simulate');
    draw();
}

function loadSavedParents() {
    $('#parents-progress-bar').removeClass('hidden');
    fileName = "parents-" + $("#identity").val() + ".json"
    loadJSON(parentsOutputPath+fileName, onParentsLoad); // code in importing_from_gephi.
}

function loadParents() {
    $('#parents-progress-bar').removeClass('hidden');
    $('#parents-files').val(""); // Select the option 
    $('#parents-files').trigger('change'); // Notify any JS components that the value changed
 
    var identity = document.getElementById("identity").value
    if (!identity) {
        $('#error').text("Please enter a user, service account, or group whose parents to graph");
    } else {
        loadJSON("../api/parents/list?identity="+identity, onParentsLoad); // code in importing_from_gephi.
    }
}

function loadSearch() {
    $('#search-progress-bar').removeClass('hidden');
    $('#parents-files').val(""); // Select the option 
    $('#parents-files').trigger('change'); // Notify any JS components that the value changed
 
    var prefix = document.getElementById("prefix").value
    if (!prefix) {
        $('#error').text("Please enter a prefix against which to match groups")
    } else {
        loadJSON("../api/search/list?prefix="+prefix, onSearchLoad); // code in importing_from_gephi.
    }
}

function loadSavedList() { 
    $('#search-progress-bar').removeClass('hidden');
    fileName = "search-" + $("#prefix").val() + ".json" 
    loadJSON(searchOutputPath+fileName, onSearchLoad); // code in importing_from_gephi.
}

// code in importing_from_gephi
function onParentsLoad(parentsObj) {
    $('#parents-progress-bar').addClass('hidden');
    if (parentsObj && parentsObj.SearchIdentity && parentsObj.NodeArr && parentsObj.EdgeArr) {
        data = {nodes: new vis.DataSet(parentsObj.NodeArr), edges: new vis.DataSet(parentsObj.EdgeArr)}
       $("#identity").val(parentsObj.SearchIdentity);
        // simulated graph and parent graph are inverted in their node representation
        // so invert when load other type
        if (stateModule.getGraphType() == "simulate") {
            invertTree()
        } 
        stateModule.setGraphType('parents');
        loadCachedFiles(); // refresh drop-down selection
        draw();
    }
}

function onSearchLoad(searchObj) {
    $('#search-progress-bar').addClass('hidden');
    if (searchObj && searchObj.GroupArr) {
        var groupArr = searchObj.GroupArr;
        $( "#group-table" ).empty();
        var groupTableHTML = "<table style='width:100%'><tr><th>Name</th><th>Description</th><th>Domain</th><th>Admin created</th><th>Direct members</th></tr>";
        for (var i=0;i<groupArr.length;i++) {
            groupTableHTML += "<tr>";
            groupTableHTML += "<td>"+groupArr[i].name+"</td>";
            groupTableHTML += "<td>"+groupArr[i].description+"</td>";
            groupTableHTML += "<td>"+groupArr[i].email.split("@")[1]+"</td>";
            groupTableHTML += "<td>"+groupArr[i].adminCreated+"</td>";
            groupTableHTML += "<td>"+groupArr[i].directMembersCount+"</td>";
            groupTableHTML += "</tr>";
        }
        groupTableHTML += "</table>";
        $("#prefix").val(searchObj.SearchPrefix);
        $(groupTableHTML).appendTo( "#group-table" );
        loadCachedFiles(); // refresh drop-down selection
    } else {
        $("<span>No matching groups found</span>").appendTo( "#group-table" );
    }
}

function draw(dataType) {

    try{
        clearInterval(progressTimer); 
    } catch(err){
    }
    progressTimer = window.setInterval(function()
        { incrementProgress() },
         progressBarInterval);

    destroy();
 
    var selectedNode = null;

    // create a network
    var container = document.getElementById('network-vis');
    var directionInput = document.getElementById("direction").value;
    var options = {
        layout: {
            improvedLayout: true, // Doesn't work for this network, and causes performance hit. For networks larger than 100 nodes it's supposed to perform clustering automatically to reduce the amount of nodes. However takes forever to stabilize
            hierarchical: {
                direction: directionInput,  // top-down is more centered with sortMethod "directed" and physics stabilization
                // https://visjs.github.io/vis-network/examples/network/layout/hierarchicalLayoutMethods.html
                // default sortMethod is hubsize, in which hub with most connections goes at top/bottom of tree
                // want root node at bottom, but directed causes edges to cross, so don't do it unless using improvedLayout: false for performance, in which case need to since otherwise root is nowhere near top/bottom of graph
                sortMethod: "directed",
                parentCentralization: false // over-ridden by physics
            }
        },
        nodes: {
            shadow: true // https://visjs.github.io/vis-network/examples/network/nodeStyles/shadows.html
        },
        interaction: { // over-ride button icons in css
            navigationButtons: true,
            keyboard: true,
            hover: true
        },
        manipulation: {
            enabled: false
        },
        
        // https://visjs.github.io/vis-network/docs/network/physics.html
        physics:{ // somewhat alleviates node spacing for large graphs, but too slow for thousands of nodes
            enabled: false, // can have disabled for speed and still following options still have effect, though different
            stabilization: {
                enabled: true, // default
                iterations: 180, // maximum number of iteration to stabilize
                updateInterval: 10,
                onlyDynamicEdges: false,
                fit: false // zoom view to fit all nodes; doesn't seem to do anything
            },
            hierarchicalRepulsion: {
                centralGravity: 0.5, // default
                springLength: 100, // default
                springConstant: 0.01, // default
                nodeDistance: 120, // default
                damping: 0.09 // default          
            }
        }
    };

    network = new vis.Network(container, data, options);
 
    // add event listeners
    // view-source:https://visjs.github.io/vis-network/examples/network/events/interactionEvents.html
    network.on('selectNode', function (params) {
        // expand cluster
        if (params.nodes.length == 1) {
            if (network.isCluster(params.nodes[0]) == true) {
                network.openCluster(params.nodes[0]);
            }
        }

        // simulated graph and parent graph are inverted in their node representation
        // so highlight other direction of connected nodes on selection
        if (stateModule.getGraphType() == "simulate") {
            direction = "from"
        } else {
            direction = "to"
        }

        // show parents
        // re-selecting a previously selected node doesn't register an event
        // so don't try to un-select
        if (selectedNode) { // reset nodes connected to previously selected node
            var connectedNodes = network.getConnectedNodes(selectedNode, direction)                   
            for (var i = 0; i < connectedNodes.length; i++) {
                currentNode = connectedNodes[i];
                data.nodes.update({id: currentNode, // index to the correct node
                color: currentNode ? { background: '#FFA807' } : { background: '#7BE141' }});
            }
        } 
        selectedNode = params.nodes; // store globally for reset on deselect
        var connectedNodes = network.getConnectedNodes(selectedNode, direction);
        for (var i = 0; i < connectedNodes.length; i++) {
            currentNode = connectedNodes[i];
            data.nodes.update({id: currentNode, // index to the correct node
            color: { background: '#97C2FC' }}); // light blue
        }
     });

    network.on('deselectNode', function (params) {
        var connectedNodes = network.getConnectedNodes(selectedNode);
        for (var i = 0; i < connectedNodes.length; i++) {
            currentNode = connectedNodes[i];
            data.nodes.update({id: currentNode, // index to the correct node
            color: currentNode ? { background: '#FFA807' } : { background: '#7BE141' }});
        }
        selectedNode = null;
    });
    network.on('hoverNode', function (params) {
        var backgroundColor;
        var currentNode = params.node;
        var parentNodes = network.getConnectedNodes(currentNode,'from');
        if (data.nodes.get(currentNode).color.background == '#97C2FC') { // selected
            backgroundColor = '#97C2FC'; // leave it
        } else { // unselected 
            backgroundColor: currentNode ? '#FFA807': '#7BE141';
        } 

        data.nodes.update({id: currentNode, // index to the correct node
            color: { background: backgroundColor } // need to set color back to original non-default 
            });
    });

}
