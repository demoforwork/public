/**
 * @fileoverview Utility to rename files 
 * Replaces existing string with another for files for which you have permission (ie. are at least an editor)
 * Inserts new string at beginning of filename if old one not present; 
 * puts it after first occurrence of prefix if present, eg. [Internal] New String Filename, and ensures there's a space after the prefix
 */

var FOLDER_ID = 'Folder Id'; 
var SUBSTR = 'Old string'; 
var NEW_SUBSTR = 'New string';
var PREFIX_START  = '[';
var PREFIX_END = ']';

/**
 * Main code
 */
function main() {
  var folder = DriveApp.getFolderById(FOLDER_ID);
  renameFiles_(folder);
}

/**
 * Recursive navigation down the folder hierarchy
 * @param {folder} folder; folder to scan, beginning with root
 * @private
 */
function renameFiles_(folder) {
  
  try {  
    
    //rename files
    var files = folder.getFiles();
    while (files.hasNext()) {
      file = files.next();
      if (!file.isTrashed()) {
        renameFile_(file);
      }
    }
    
    //do the same for nested folders
    var folders = folder.getFolders();
    while (folders.hasNext()) {    
      var folder = folders.next();
      renameFiles_(folder);
    }

  }
  catch (error) {
    Logger.log(error);
  }
  
}

/**
 * Rename a file
 * @param {file} file to rename
 * @private
 */
function renameFile_(file) {
  var prefix;
  var fileName = file.getName();
  var newFileName = fileName;

  // cleanup prefix spacing
  if (fileName.substring(0,1) == PREFIX_START) {
    var fileNameSplit = fileName.split(PREFIX_END);
    prefix = '';
    if (fileNameSplit[1].substring(0,1)) { // not blank
      // insert a blank for readability
      prefix = ' ';
    }
    newFileName = fileNameSplit[0] + PREFIX_END + prefix + fileNameSplit[1];
  }
  
  // replace full string with abbreviation
  if (newFileName.search(NEW_SUBSTR) > -1) {
    // no action required
  }
  else if (newFileName.toLowerCase().search(NEW_SUBSTR.toLowerCase()) > -1) {
    // replace lower/mixed case with provided case
    newFileName = newFileName.replacei(NEW_SUBSTR, NEW_SUBSTR);
  }
  else if (newFileName.toLowerCase().search(SUBSTR.toLowerCase())  > -1) {
    // replace full string with abbreviated string using case insensitive replace
    newFileName = newFileName.replacei(SUBSTR, NEW_SUBSTR);
  }
  else if (newFileName.substring(0,1) == PREFIX_START) {
    var fileNameSplit = newFileName.split(PREFIX_END);
    newFileName = fileNameSplit[0] + PREFIX_END + ' ' + NEW_SUBSTR + ' ' + fileNameSplit[1];
  }
  else {
    newFileName = NEW_SUBSTR + ' ' + newFileName;
  }

  newFileName = newFileName.replace('  ', ' ');
  if (newFileName != fileName) {
    try {
      file.setName(newFileName);
    }
    catch (error) {
      Logger.log(file.getName() + ': ' + error);
    }
  }
}

// case insensitive replace from https://stackoverflow.com/questions/7313395/case-insensitive-replace-all
String.prototype.replacei = function (rep, rby) {
  var pos = this.toLowerCase().indexOf(rep.toLowerCase());
  return pos == -1 ? this : this.substr(0, pos) + rby + this.substr(pos + rep.length);
};
