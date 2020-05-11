/**
* Include javascript and css in html template
* @param {String} filename
* @return {HtmlOutput} dashboard 
 */
function include(filename) { 
  return HtmlService.createHtmlOutputFromFile(filename)
      .getContent();
}