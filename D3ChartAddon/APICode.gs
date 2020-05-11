/**
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Return an array of potential columns (identifiers to locate them in
 * the data response object and the labels to use as column headers).
 * @return {Array} list of potential columns.
 */
function getColumnOptions() {
  var columns = [];

  // TODO: Replace this section, adding a column entry for each data of
  // interest. id should be an identifier that can be used to locate
  // the data in the data request response, and label should be the name
  // to associate with that data in the UI.
  columns.push({id: 'quarter', label: 'Quarter'});
  columns.push({id: 'country', label: 'Country'});
  columns.push({id: 'count', label: 'Count'});

  return columns;
}

/**
 * Return a page of results from the data source as a 2D array of
 * values (with columns corresponding to the columns specified). Return
 * null if no data exists for the specified pageNumber.
 * @param {Array} columns an array of Strings specifying the column ids
 *   to include in the output.
 * @param {Number} pageNumber a number indicating what page of data to
 *   retrieve from the data source.
 * @param {Number} pageSize a number indicating the maximum number of
 *   rows to return per call.
 * @param {Object} opt_settings optional object containing any additional
 *   information needed to retrieve data from the data source.
 */
function getDataPage(columns, pageNumber, pageSize, opt_settings) {
  var data = null;
  /**
   * TODO: This function needs to be implemented based on the particular
   * details of the data source you are extracting data from. For example,
   * you might request a page of data from an API using OAuth2 credentials
   * similar to this:
   *
   * var service = getService(); // Be sure to configure the Auth.gs code
   *
   * // Build the appropriate API URL based on the parameters (pageNumber,
   * // pageSize, and opt_settings).
   * var url = '...';
   * var response = UrlFetchApp.fetch(url, {
   *   headers: {
   *     Authorization: 'Bearer ' + service.getAccessToken(),
   *     // Include any API-required headers needed for the call
   *   }
   * });
   *
   * // Given the response, construct the appropriate data output. Return
   * // null if there is no data for the specified page.
   * if (noData(response)) {
   *   return null;
   * }
   * data = [];
   *
   * // Iterate over each relevant data item in the API response and build
   * // a data row for it containing the data specified by columns
   * // (in the same column order). Add each data row to data.
   *
   */

  var columnsArrLen = columns.length;
  
  var spreadsheetKey = '11VHVC7H4lCsitNpbDf6e60OQ_g5DgTwQCMln364Jjzs';
  var sheetName = 'Sheet1';
  var spreadsheet = SpreadsheetApp.openById(spreadsheetKey);
  var dataArr = getSpreadsheetRows(spreadsheet,sheetName);
  var dataArrLen = dataArr.length;
  
  var rowObj;
  var importRow;
  var data = [];
  for (var i=1;i<dataArrLen;i++) { // skip header row
    importRow = [];
    rowObj = dataArr[i];
    for (var j=0;j<columnsArrLen;j++) {
      if (dataArr[0][columns[j]]) {  // check header rather than row because otherwise won't push zero values onto array.
        importRow.push(dataArr[i][columns[j]]);
      }
    }
    data.push(importRow);
  }
    
  return data;
}