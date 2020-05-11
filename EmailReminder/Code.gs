/*
Copyright 2019 Ferris Argyle. All rights reserved.

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

/**
 * @fileoverview Contains business logic
 */

function sendReminders() {
  var threadsArr;
  var threadsArrLen;
  var thread;
  var messageArr;
  var messageCount;
  var messageCount;
  var lastMessageIndex;
  var message;
  var reminderDueObj;

  var activeUser = Session.getActiveUser().getEmail();
  
  var start = 0;  
  while (start <= MAX_THREADS) {
    threadsArr = GmailApp.getInboxThreads(start, PAGE_SIZE);
    threadsArrLen = threadsArr.length;
    for (var i = threadsArrLen; i--;) {
      thread = threadsArr[i];
      if (!thread.isInTrash()) {
        messageArr = thread.getMessages();
        messageCount = thread.getMessageCount();
        // process latest message in thread 
        lastMessageIndex = messageCount - 1;
        message = messageArr[lastMessageIndex];
        if (!message.isInTrash()) {
          // send reminder if overdue
          sendReminder_(activeUser, message, thread.getLabels()); 
        }
      }
    }
    start=start+PAGE_SIZE;
  }
}

function sendReminder_(activeUser, message, threadLabelArr) {
  var overdueObj;
  
  var isReminderDue = false;
  var isLabelBased = false;
  var messageDate = message.getDate();
  
  var activeId = activeUser.split('@')[0];
  var from = getId_(message.getFrom()); // from returns string
  if (from == activeId) { // ie. last message isn't a response from someone else; don't need this check functionally, since in that case won't have the trigger bcc., but more performant to eliminate before parsing bcc.
    
    // outbound emails with trigger
    //{isOverdue: isOverdue, isLabelBased: isLabelBased, numDays: numDays}; 
    overdueObj = isOverdue_(messageDate, message.getBcc());
    if (overdueObj.isOverdue) {
      sendMail_(message);
    }
    else {
      overdueObj = isOverdue_(messageDate, message.getCc());
      if (overdueObj.isOverdue) { // undocumented feature in case of user error putting the trigger in the wrong address line
        sendMail_(message);
      }   
      // inbound emails with trigger
      else {
        overdueObj = isOverdue_(messageDate, message.getTo());
        if (overdueObj.isOverdue) {
          sendMail_(message);
        }
      }
    }
  }
  else {
    // missed inbound emails by label
    var to = message.getTo(); 
    if (message.isUnread()) { // ignore read emails on the assumption that you'll mark emails unread or use the trigger-based reminder capability if you still need to deal with it
        // && to.search(activeUser) > -1) {  // ignore emails for which you're just on the cc. list: remove this since can do in label
      overdueObj = isOverdue_(messageDate, null, threadLabelArr);
      if (overdueObj.isOverdue) {   
        // need to add bcc with + days or it won't be actioned again if you miss it since it's now from you
        sendMail_(message, overdueObj.numDays, activeUser);
      }
    }
  }

  //***********************************  
  function isOverdue_(messageDate, cc, threadLabelArr) {
    var id;
    var idSplitArr;
    var numDays;

    var isOverdue = false;
    
    if (cc) { // bcc- or cc-based trigger time period
      var ccArr = cc.split(',');
      var ccArrLen = ccArr.length;
      for (var i = ccArrLen; i--;) {
        id = getId_(ccArr[i]);
        idSplitArr = id.split('+');
        if (idSplitArr[1] && idSplitArr[0] == activeId) {
          numDays = idSplitArr[1];
          isOverdue = areTooManyDaysElapsed_(numDays, messageDate);
          if (isOverdue) break;
        }
      }
    }
    else if (threadLabelArr) { // label-based time period
      var threadLabelLen = threadLabelArr.length;
      for (var i = threadLabelLen; i--;) {
        numDays = LABEL_DAYS_OBJ[threadLabelArr[i].getName()];
        if (numDays != null) { // this is just a check for errors in the config; can't just check for falseness because 0 days is false
          isOverdue = areTooManyDaysElapsed_(numDays, messageDate);
          if (isOverdue) break;
        }
      }
    }
    
    function areTooManyDaysElapsed_(numDays, messageDate){
      var daysElapsed;
      var isOverdue = false;
      if (numDays != null && (TEST || numDays > 0)) { // can't just check for falseness because 0 days is false
        daysElapsed = getDaysElapsed_(messageDate);
        if (daysElapsed >= numDays) {
          isOverdue = true;
        }
      }
      
      function getDaysElapsed_(messageDate) {
        
        moment.locale(Session.getActiveUserLocale());
        var messageDate = moment(messageDate);
        var today = moment(new Date());
        
        return today.businessDiff(messageDate, 'days');
      }
      
      return isOverdue;
    }
    //***********************************
    
    return {isOverdue: isOverdue, numDays: numDays}; 
  }
  
  function getId_(address) {
    var addressPrefix = address.split('@')[0];
    var addressSplitArr = addressPrefix.split('<');
    var id = (addressSplitArr.length == 1) ? addressSplitArr[0] : addressSplitArr[1];
    
    return id.trim();
  }
  
  function sendMail_(message, numDays, activeUser) {
    var to;
    var cc = '';
    if (numDays == null) {
      to = message.getTo();
      var cc = message.getCc();
    }
    else {
      to = activeUser;
    }
    var bcc = message.getBcc();
    if (numDays != null && bcc.search(activeUser) == -1) { // can't just check for falseness because 0 days is false
      // add bcc with + days or it won't be actioned again if you miss it since it's now from you
      var bccAddendum = activeUser.split('@')[0] + '+' + numDays + '@' + activeUser.split('@')[1];
      bcc = bcc ? bcc + ',' + bccAddendum : bccAddendum;
    }
    
    var messageBody = message.getBody();
    if (messageBody.search(INITIAL_REMINDER) > -1 || messageBody.search(SUBSEQUENT_REMINDER) > -1) {
      messageBody = SUBSEQUENT_REMINDER + messageBody;  
    }
    else {
      messageBody = INITIAL_REMINDER + messageBody;
    }
    message.forward(to, {
      cc: cc,
      bcc: bcc,
      htmlBody: messageBody
    });
  }
 
}




