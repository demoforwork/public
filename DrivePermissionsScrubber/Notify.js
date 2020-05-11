/**
 * @fileoverview Send notification email
 */

/**
 * Send notification email 
 * @param {obj} list of all notifications indexed by file/folder id
 * @param {string} root folder name: used in email subject and content
 * @private
 */
function notify_(notificationObj, rootFolderName) {
  var html = HtmlService.createTemplateFromFile('email');
  html.sharedFolderObj = SHARED_FOLDER_OBJ;
  html.removeFilePermissions = REMOVE_FILE_PERMISSIONS;
  html.notifyFileIssues = NOTIFY_FILE_ISSUES;
  html.notificationObj = notificationObj;
  html.rootFolderName = rootFolderName;

  var message = html.evaluate();  
  var subject = rootFolderName + ' Inadvertent Shares';
  GmailApp.sendEmail(NOTIFICATION_EMAIL,
                     subject,
                     message.getContent(), {
                       noReply: true,
                       htmlBody: message.getContent()
                     }
                    );

}
