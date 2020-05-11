/**
* Draw the visualization
* - define the datatable, controls, and charts, and bind them together in the handler
* @param 
* @return
*/
function drawVisualization() {

  // &gid rather than #gid of spreadsheet url
  // must be old spreadsheets: new spreadsheets don't support Charts Query Language
  var dataSourceUrl = 
  'https://spreadsheets.google.com/a/google.com/tq?key=0AreOaxjf0g3YdEE1ZlBhbG4yQzlnc3dKM0Q4MHpGWnc&gid=13'; // https and a/google.com sections ensure GAIA authentication works correctly in SSO scenario

 
  var query = new google.visualization.Query(dataSourceUrl);
  query.send(handleQueryResponse);
 
}

function handleQueryResponse(response) {
  var data = response.getDataTable();
  
  // Define category picker controls       
  var categoryPicker1 = categoryPicker('control1','VP');
  var categoryPicker2 = categoryPicker('control2','Director');
  var categoryPicker3 = categoryPicker('control3','Business Unit');

  // Define a Column chart
  var columnChart = new google.visualization.ChartWrapper({
    chartType: 'ColumnChart',
    containerId: 'chart1', // refers back to html id
    options: {
      chartType: 'ColumnChart', 
      isStacked: false,
      title: 'Budget by Business Unit',
      hAxisTitle: 'Stage',
      vAxis: {title:'# of Days', format: '#,###'},
      width: '700px'
    },
    // Instruct the chart which DataTable columns to use, base 0
    'view': {'columns': [2,3,4,5,6,7,8,9,10,11,12]}
  });
  
  // Define a table
  var table = new google.visualization.ChartWrapper({
    chartType: 'Table',
    containerId: 'chart2', // refers back to html id
    options: {
      width: '100%'
    }
  });
  
  // Create a dashboard
  new google.visualization.Dashboard(document.getElementById('dashboard')).  // refers back to html id
  // Establish bindings, declaring the category pickers will drive both charts
  bind([categoryPicker1,categoryPicker2,categoryPicker3], [columnChart, table]).
  
  // Draw the entire dashboard
  draw(data);
}

/**
* Define the category picker control
* @param {string} containerId - html container id in which to place the category picker
* @param {string} filterColumnLabel - Label of the control; ties back to the spreadsheet column header
* @return
*/
function categoryPicker(containerId, filterColumnLabel) {
  
  return new google.visualization.ControlWrapper({
    'controlType': 'CategoryFilter',
    'containerId': containerId,
    'options': {
      'filterColumnLabel': filterColumnLabel,
      'ui': {
        'labelStacking': 'vertical',
        'allowTyping': false,
        'allowMultiple': true
      }
    }
  });
}

// initiate the chart drawing when the page has completed loading
google.setOnLoadCallback(drawVisualization);