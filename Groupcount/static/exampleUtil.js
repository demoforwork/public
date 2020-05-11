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

// Based on https://visjs.github.io/vis-network/examples/network/exampleUtil.js

function getScaleFreeNetwork(nodeCount) {
  var nodes = [];
  var edges = [];
  var connectionCount = [];
  var clusterStart = 100;

  // randomly create some nodes and edges
  for (var i = 0; i < nodeCount; i++) {
    nodes.push({
      id: i,
      //label: String(i)
      label: i ? 'Group '+String(i) : 'Service account',
      group: group = i ? 2 : 0, // show Service Account in different color,
      color: i ? { background: '#FFA807' } : { background: '#7BE141' },
      clusterNode: i > clusterStart ? true : false
      //title: 'I have a popup!'
      // light-blue: #97C2FC
      // light-green: #C2FABC 
      
    });

    connectionCount[i] = 0;

    // create edges in a scale-free-network way
    if (i == 1) {
      var from = i;
      var to = 0;
      edges.push({
        from: from,
        to: to,
        color: {color:'#D2D2D2'}
      });
      connectionCount[from]++;
      connectionCount[to]++;
    }
    else if (i > 1) {
      var conn = edges.length * 2;
      var rand = Math.floor(seededRandom() * conn);
      var cum = 0;
      var j = 0;
      while (j < connectionCount.length && cum < rand) {
        cum += connectionCount[j];
        j++;
      }


      var from = i;
      var to = j;
      edges.push({
        from: from,
        to: to,
        color: {color:'#D2D2D2'}
      });
      connectionCount[from]++;
      connectionCount[to]++;
    }
  }
  return {nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges)};
}

var seededRandom = vis.util.Alea('SEED');