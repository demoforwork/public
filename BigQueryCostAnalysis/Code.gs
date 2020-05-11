/**
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Contains core functionality to retrieve the job and cost info from the BigQuery and Pricing APIs 
 * and populate the spreadsheet
 * Based on https://developers.google.com/apps-script/advanced/bigquery
 */

 /**
 * Create sidebar to specify for which projects to retrieve BigQuery jobs
 * @private
 */
function listJobsUi_() {
  
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getActiveSheet();
  
  var template = HtmlService.createTemplateFromFile('listJobsUi');  // calls listJobs()
  
  // template variables
  var configObj = {};
  configObj.sheetId = sheet.getSheetId();
  template.projectId = sheet.getName();  
  //template.maxRows = 50;
  template.configObj = configObj;
  
  var output = template.evaluate().setSandboxMode(HtmlService.SandboxMode.IFRAME).setTitle('List Jobs'); 
  
  SpreadsheetApp.getUi().showSidebar(output);
}

/**
 * Get header row, and job list from BigQuery API and populate the sheet
 * @param {string} sheetId Sheet Id of sheet to populate
 * @param {string} projectId Project for which to get BigQuery jobs
 * @param {number} maxRows Maximum number of rows to get, in increment of 50; 
 *     BigQuery history goes back 6 months, could take too long or time out on retrieval
 */
function listJobs(sheetId, projectId, maxRows) {
  
  var reportSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(projectId); // sheet currently associated with this report, ie. based on last run
  var activeSheet = SpreadsheetApp.getActiveSheet();
  if (projectId && reportSheet != null && reportSheet.getSheetId() != activeSheet.getSheetId()) { // allow re-import of current sheet
    alert_("A sheet already exists for this project; please rename it if you'd like to re-import.", 'Error');
  }
  else {
  
    var responseObj = getHeader_();
    var valueArr = [responseObj.valueArr];
    var fontWeightArr = [responseObj.fontWeightArr];
    var backgroundArr = [responseObj.backgroundArr];
    
    var responseObj = runJobList_(projectId, maxRows, responseObj.valueArr.length);
    if (responseObj.success) {
      valueArr = valueArr.concat(responseObj.valueArr);
      fontWeightArr = fontWeightArr.concat(responseObj.fontWeightArr);
      backgroundArr = backgroundArr.concat(responseObj.backgroundArr);
      
      Logger.log('68');
      var arrLen = valueArr.length;
      Logger.log('70');
      if (arrLen > 1) { // more than header row
        
        var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
        var sheet = spreadsheet.getActiveSheet();
        sheet.clear();
        sheet.setName(projectId); 
        
        sheet.getRange(1, 1, arrLen, valueArr[0].length).setValues(valueArr);
        sheet.getRange(1, 1, arrLen, valueArr[0].length).setFontWeights(fontWeightArr);
        sheet.getRange(1, 1, arrLen, valueArr[0].length).setBackgrounds(backgroundArr); 
        
        alert_((arrLen-1).toString() + ' jobs listed', 'Success');
      } else {
        alert_('No rows returned', 'Error');
      }
    }
    else {
      alert_('No BigQuery jobs found for this project', 'Error');
    }
  }
}

/**
 * Get header row
 * @return {object} Object of arrays for values, font weight, and background
 * @private
 */
function getHeader_() {
  var valueArr = [JOB_ID_COL_NAME, 'Start Time', 'End Time', 'Bytes Processed', 'Bytes Billed', 'Billing Tier', 'Dollars Billed', USER_EMAIL_COL_NAME, 'Dest. Dataset', 'Dest. Table', 'Query'];
  var fontWeightArr = [];
  var backgroundArr = [];
  var valueArrLen = valueArr.length;
  for (var i=0;i<valueArrLen;i++) {
    fontWeightArr.push('bold');
    backgroundArr.push(HEADER_BACKGROUND_GREY);
  }
  return {valueArr: valueArr, fontWeightArr: fontWeightArr, backgroundArr: backgroundArr};
}

/**
 * Get job list from BigQuery API
 * @param {string} projectId Project for which to get BigQuery jobs
 * @param {number} maxRows Maximum number of rows to get, in increment of 50; 
 *     BigQuery history goes back 6 months, could take too long or time out on retrieval
 * @param {number} noFields Number of fields in header: use this to pad job list arrays to correct length 
 * @return {object} Object of arrays for values, font weight, and background; also contains success flag
 * @private
 */
function runJobList_(projectId, maxRows, noFields) {
  Logger.log('noFields '+noFields);
  
  var responseObj = {};
  try {
    https://cloud.google.com/bigquery/docs/reference/v2/jobs/list
    var queryresponses = BigQuery.Jobs.list(projectId, {allUsers: true, projection: "full", stateFilter: "done"
                                                     }); 
    
    // Get first page of rows of response
    var rows = queryresponses.jobs;
    var rowCounter = queryresponses.jobs.length;
    
    while (queryresponses.nextPageToken && rowCounter < maxRows) {
      
      queryresponses = BigQuery.Jobs.list(projectId, {allUsers: true, projection: "full", stateFilter: "done",
                                                      pageToken: queryresponses.nextPageToken
                                                     });
      rows = rows.concat(queryresponses.jobs);
      rowCounter++;
      
    }
    
    // Need to amend this after Jan 1, 2016: https://cloud.google.com/bigquery/pricing#tiers
    var terabyte = Math.pow(2,40);
    var bigQueryPriceObj = getBigQueryPricing_(); 
    var bigQueryFree = bigQueryPriceObj.interactiveQueries.freequota.quantity * terabyte; // not used; use totalBytesBilled instead
    var bigQueryDollarsPerTerabyte = bigQueryPriceObj.interactiveQueries.us;
    
    var jobObj;
    var valueArr = [];
    var valueRowArr = [];
    var valueRowArrLen;
    var fontWeightArr = [];
    var fontWeightRowArr;
    var backgroundArr = [];
    var backgroundRowArr;
    var startTime;
    var endTime;
    
    var  totalBytesProcessed;
    var totalBytesBilled
    var billingTier;
    var dollarsBilled;
    
    if (rows) {
      
      for (var i = 0; i < rows.length; i++) {
        fontWeightRowArr = [];
        backgroundRowArr = [];
        jobObj = rows[i];
        startTime = new Date(Number(jobObj.statistics.startTime));
        endTime = new Date(Number(jobObj.statistics.endTime));
        var queryObj = jobObj.statistics.query;
        if (queryObj) {
          totalBytesProcessed = queryObj.totalBytesProcessed;
          totalBytesBilled = queryObj.totalBytesBilled;
          billingTier = (queryObj.billingTier) ? queryObj.billingTier : '';
          dollarsBilled = totalBytesBilled/terabyte * bigQueryDollarsPerTerabyte;
        }
        else {
          totalBytesProcessed = null;
          totalBytesBilled = null;
          billingTier = null;
          dollarsBilled = null;
        }
        valueRowArr = [jobObj.jobReference.jobId,
                       startTime.toDateString() + ' ' + startTime.toTimeString(),
                       endTime.toDateString() + ' ' + endTime.toTimeString(),
                       totalBytesProcessed,
                       totalBytesBilled,
                       billingTier,
                       dollarsBilled];
        valueRowArrLen = valueRowArr.length; // would be more efficient to do this outside of loop, but makes code more brittle     
        for (var j=valueRowArrLen;j<noFields;j++) {
          valueRowArr.push(null);
        } 
        valueArr.push(valueRowArr);
        for (var j=0;j<noFields;j++) {
          fontWeightRowArr.push('normal');
          backgroundRowArr.push(VALUE_BACKGROUND_GREY);
        }
        fontWeightArr.push(fontWeightRowArr);
        backgroundArr.push(backgroundRowArr);
        
      }
    }
    responseObj = {success: true, valueArr: valueArr, fontWeightArr: fontWeightArr, backgroundArr: backgroundArr};
  }
  catch(err) {
    var message;
    if (err.message == '"BigQuery" is not defined.') {
      message = "BigQuery API isn't available; turn it on under Tools -> Script -> Resources -> Advanced Google services...";
    }
    else if (err.message.indexOf('The API (BigQuery API) is not enabled for your project') > -1) {
      message = "BigQuery API isn't available; turn it on under Tools -> Script -> Resources -> Advanced Google services... -> Google Developers Console";
    }
    else {
      message = err.message;
    }
    alert_(message, 'Error');
  }
  return responseObj;
}

/**
 * Get BigQuery pricing from pricing calculator JSON API
 * @return {object} Object with pricing
 * @private
 */
function getBigQueryPricing_() {
  var priceObj = {};
  try {
    var response = UrlFetchApp.fetch('https://cloudpricingcalculator.appspot.com/static/data/pricelist.json');
    priceObj = JSON.parse(response.getContentText());
  }
  catch(err) {
    alert_(err.message, 'Error');
  }
  
  return priceObj.gcp_price_list['CP-BIGQUERY-GENERAL'];
}

/**
 * Get job details including submittor and query for selected jobs from BigQuery API and populate selected sheet rows
 * @private
 */
function getJobs_() {
  var spreadSheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadSheet.getActiveSheet();
  var range = sheet.getActiveRange();
  var firstRowIndex = range.getRowIndex();
  var lastRowIndex = range.getLastRow();
  if (firstRowIndex == 1 || lastRowIndex > sheet.getLastRow()) {
    alert_('Please select valid spreadsheet rows','Error');
  }
  else {
    var projectId = sheet.getName();
    var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues();   
    var jobIdColIndex = getColIndexByName_(headerRow, JOB_ID_COL_NAME); 
    var userEmailColIndex = getColIndexByName_(headerRow, USER_EMAIL_COL_NAME); 
    var jobArr = [];
    for (var i=firstRowIndex;i<=lastRowIndex;i++) {
      var jobId = sheet.getRange(i, jobIdColIndex).getValue();
      
      var responseObj = runJobGet_(projectId,jobId);
      if (responseObj.success) {     
        jobArr.push([responseObj.user_email, responseObj.destinationDataset, responseObj.destinationTable, responseObj.query]);
      }
      else {
        jobArr.push([null, null, null, null]);
      }
    }
    var numRows = lastRowIndex - firstRowIndex + 1;
    sheet.getRange(firstRowIndex, userEmailColIndex, numRows, 4).setValues(jobArr);
  }
  return;
}

/**
 * Get job details including submittor and query for selected jobs from BigQuery API and populate selected sheet rows
 * @param {string} projectId Project for which to get BigQuery jobs
 * @param {string} jobId Job Id for which to get job details
 * @return {object} Job details object; also contains success flag
 * @private
 */
function runJobGet_(projectId, jobId) {
  
  var responseObj = {};
  try {
    var response = BigQuery.Jobs.get(projectId, jobId);
    
    if (response.configuration) {
      responseObj.success = true;
      responseObj.user_email = response.user_email;
      responseObj.query = response.configuration.query.query;
      responseObj.destinationDataset = response.configuration.query.destinationTable.datasetId;
      responseObj.destinationTable = response.configuration.query.destinationTable.tableId;
    }
    else {
      responseObj.success = false;
      Browser.msgBox('Error: ' + JSON.stringify(response));
    }
  }
  catch(err) {
    var message;
    if (err.message == '"BigQuery" is not defined.') {
      message = "BigQuery API isn't available; turn it on under Tools -> Script -> Resources -> Advanced Google services...";
    }
    else if (err.message.indexOf('The API (BigQuery API) is not enabled for your project') > -1) {
      message = "BigQuery API isn't available; turn it on under Tools -> Script -> Resources -> Advanced Google services... -> Google Developers Console";
    }
    else {
      message = err.message;
    }
    alert_(message, 'Error');
  }

  return responseObj;
}
