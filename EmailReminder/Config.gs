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
 * @fileoverview Contains global variable declarations
 */

// Reminder messages
var INITIAL_REMINDER = "Gentle reminder on this...<p>";
var SUBSEQUENT_REMINDER = "...and another...<p>"; // can't include brackets or other javascript syntactical signals since they break the string.search()

// Label-based reminders for missed inbout email as object: {label:days,...]
// Labels are case sensitive
// Days is how frequently you'll get reminders for unread emails to you with this label; cc's are ignored
var LABEL_DAYS_OBJ = {[YOUR REMINDER LABEL]:2};


var PAGE_SIZE = 5; // pagination gets us past the 500 threads max, which may not be enough for weekly reminders
// Maximum number of threads to search, in multiples of PAGE_SIZE
// Set to a value large enough to process all mail threads in the desired time period (eg. past week), and under the Apps Script timeout limit
var MAX_THREADS = 10; 

var TEST = false; // enable zero elapsed day testing