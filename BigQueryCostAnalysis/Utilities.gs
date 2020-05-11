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
 * @fileoverview Contains utility functions
 */

/**
 * Get index of column in sheet by column name (ie. header)
 * @param {array} headerRow Sheet header row in which to search
 * @param {string} colName Column name to search for
 * @return {number} Column index or -1 if not found
 * @private
 */
function getColIndexByName_(headerRow,colName) {
  for (i in headerRow[0]) {
    var name = headerRow[0][i];
    if (name == colName) {
      return parseInt(i) + 1;
    }
  }
  return -1;
}

/**
 * Display alert as toast
 * @param {string} message Message to display
 * @param {string} messageType Message type: "Success", "Warning", "Error"
 * @private
 */
function alert_(message, messageType) {
  
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  spreadsheet.toast(message, messageType, TOAST_TIMEOUT_SECONDS);
}