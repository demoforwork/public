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
 * @fileoverview Contains initialization functions
 */

// Define global constants
var JOB_ID_COL_NAME = 'Job Id';
var USER_EMAIL_COL_NAME = 'User Email';

var HEADER_BACKGROUND_GREY = '#F2F3F3';
var VALUE_BACKGROUND_GREY = '#F5F7FF';
var TOAST_TIMEOUT_SECONDS = 7

/**
 * Create menu on spreadsheet open event
 */
function onOpen(e) {
  var menu = SpreadsheetApp.getUi().createMenu('BigQuery Log Analysis');
  menu.addItem('List Jobs', 'listJobsUi_')
  .addItem('Get Job Details', 'getJobs_')
  .addSeparator()  
  .addItem('Help', 'help_');
  
  menu.addToUi();
}