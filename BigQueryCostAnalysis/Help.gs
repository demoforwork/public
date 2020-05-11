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
 * @fileoverview Contains functions for displaying Help dialog
 * Depends on the help.html file
 */

/**
 * Create help dialog
 * @private
 */
function help_() {

  var HTMLToOutput;
  HTMLToOutput = HtmlService.createHtmlOutputFromFile('help').getContent();
  var output = HtmlService.createHtmlOutput(HTMLToOutput).setSandboxMode(HtmlService.SandboxMode.IFRAME);
  output.setHeight(400).setWidth(400);

  SpreadsheetApp.getActiveSpreadsheet().show(output);
}