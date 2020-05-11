'use strict'; // ???

angular.module('SelfService', ['ngSanitize', 'ui.select'])  

 .factory('API', function($http) {
    return{
      // passing parameter to service: http://stackoverflow.com/questions/19890706/passing-arguments-to-a-service-in-angularjs  
      // passing parameters back to callback in javascript: http://stackoverflow.com/questions/14200021/passing-a-callback-function-with-included-parameters
      getData: function(paramObject, callback){ 
        var serverPath = '';
        if (window.location.host.indexOf('localhost') != -1) {
          serverPath = window.location.protocol + '//' + window.location.host;
        }
        else{
          serverPath = "https:" + '//' + window.location.host;
        }
        var selfServiceAPI = serverPath + "/api";

        var restAPI = serverPath + "/api/" + paramObject.endpoint + paramObject.args;
        //$http.get(restAPI).success(function(response) {
        //    callback(paramObject, response)});
        $http.get(restAPI).then(function onSuccess(response) {
            callback(paramObject, response.data)});
      }
    }
  })

 .controller('MainCtrl', ['$scope','API', 
   
    function (scope, API) { 

        //console.log(scope.existingAccount);
        scope.master = {};       
        scope.user = angular.copy(scope.master);   
        scope.domain = {}; // required as model for domain selection
        scope.org = {}; // required as model for org selection

        // must declare function before referencing
        scope.init = function() {   
            scope.newUser = false;        
            scope.accountType = "main";
            scope.isInputDisabled = true;
            scope.submitDisabled = true;
            scope.submitButtonText = "Submit";
        };

        scope.init();
        getProperties(scope, API);

        // watch for domain change since ui-select on-select doesn't seem to work
        scope.$watch('domain.selected', function (newVal, oldVal) {
            if (oldVal == newVal) return;
            scope.getUser();
            scope.org.selected = "";
        }, true);

        scope.$watch('org.selected', function (newVal, oldVal) {
            if (oldVal == newVal) return;
            scope.submitDisabled = false;
        }, true);

        scope.$watch('user.password', function (newVal, oldVal) {
            if (!newVal) return;
            scope.submitDisabled = false;
        }, true);
        
        scope.reset = function() {           
            scope.accountType = "main";
            scope.domain.selected = "";
            scope.org.selected = "";
            scope.user.givenName = "";
            scope.user.familyName = "";
            scope.user.password = "";
            scope.user.password2 = "";
            scope.submitDisabled = true;
            scope.submitButtonText = "Submit";
            scope.msg = "";
            scope.isInputDisabled = false;
        };

        scope.getUser = function() {
            if (scope.domain.selected) {
                getUser(scope, API);
                scope.user.password = "";
                scope.user.password2 = "";
            }
        };

        scope.submit = function() {
            if (scope.user.password != scope.user.password2) {
                scope.msg = "Passwords must match";
                scope.msgClass = 'error';               
            }
            else if (!scope.newUser) {
                setPassword(scope, API);
            }
            else if (scope.domain.selected.orgs.length > 0 && !scope.org.selected) {
                scope.msg = "Please select an organization";
                scope.msgClass = 'error';
            }
            else {
                insertUser(scope, API);
            }
        };
    }

  ])

function getProperties(scope, API) {
    scope.msg = 'Initializing...';
    scope.msgClass = 'highlight-color';
    var paramObject = {endpoint:'getProperties', args: ''};
    API.getData(paramObject, function(paramObject, response){
        console.log('response '+JSON.stringify(response));
        scope.domainArr = [];

        if (response.code == 200) {              
            scope.isInputDisabled = false;
            scope.propertyObj = response.payload.domains;
            scope.user.userName = response.payload.userName;
            scope.domainArr = response.payload.domains;
            if (scope.domainArr.length == 0) {
                scope.submitDisabled = false;
            }
            scope.msg = '';
        }
        else {
            scope.msg = response.msg;
            scope.msgClass = 'error';
        }
        
    })
}

function getUser(scope, API) {

    console.log(scope.user.userName);
    console.log(scope.accountType == "main" ? scope.user.userName : "d_"+scope.user.userName);
    console.log(scope.domain.selected.domain);

    scope.msg = 'Checking whether this user already exists...';
    scope.msgClass = 'highlight-color';
    scope.isInputDisabled = true;
    var userName = scope.accountType == "main" ? scope.user.userName : "d_"+scope.user.userName;
    var paramObject = {endpoint:'getUser', args: '?domain='+scope.domain.selected.domain+'&user='+userName};
    console.log('paramObject '+JSON.stringify(paramObject))
    API.getData(paramObject, function(paramObject, response){
        console.log('response '+JSON.stringify(response));

        if (response.code == 200) {        
            scope.user.givenName = response.payload.givenName;
            scope.user.familyName = response.payload.familyName;
            scope.newUser = false;
            scope.submitButtonText = "Set Password";
        }
        else {
            scope.user.givenName = "";
            scope.user.familyName = "";
            scope.newUser = true;
            scope.submitButtonText = "Create User";
        }
        scope.isInputDisabled = false;
        scope.msg = '';

    })
}

function insertUser(scope, API) {

    console.log(scope.accountType == "main" ? scope.user.userName : "d_"+scope.user.userName);
    console.log(scope.user.givenName)

    var org = (scope.org.selected) ? scope.org.selected : ''; // replace 'undefined' with empty string

    scope.msg = 'Adding user...';
    scope.msgClass = 'highlight-color';
    scope.isInputDisabled = true;
    var userName = (scope.accountType == "main" ? scope.user.userName : "d_"+scope.user.userName);
    var paramObject = {endpoint:'insertUser', args: '?requestor='+scope.user.userName+'&domain='+scope.domain.selected.domain+'&user='+userName+'&givenName='+scope.user.givenName+'&familyName='+scope.user.familyName+'&password='+scope.user.password+'&org='+org};
    console.log('paramObject '+JSON.stringify(paramObject))
    API.getData(paramObject, function(paramObject, response){
        console.log('response '+JSON.stringify(response));

        /*
        if (response.code == 200) { 
            scope.msg = response.msg; //"User "+userName+" successfully added to domain "+scope.domain.selected.domain;
            scope.msgClass = 'success';
        }
        else {
            scope.msg = "User "+userName+" couldn't be added to domain "+scope.domain.selected.domain;
            scope.msgClass = 'error';
        } */
        scope.msg = response.msg; //"User "+userName+" successfully added to domain "+scope.domain.selected.domain;
        scope.msgClass = response.code == 200 ? 'success' : 'error'
        scope.isInputDisabled = false;

    })
}

function setPassword(scope, API) {

    console.log(scope.accountType == "main" ? scope.user.userName : "d_"+scope.user.userName);
    console.log(scope.user.givenName)

    scope.msg = 'Setting password...';
    scope.msgClass = 'highlight-color';
    scope.isInputDisabled = true;
    var userName = (scope.accountType == "main" ? scope.user.userName : "d_"+scope.user.userName);
    var paramObject = {endpoint:'setPassword', args: '?requestor='+scope.user.userName+'&domain='+scope.domain.selected.domain+'&user='+userName+'&password='+scope.user.password};
    console.log('paramObject '+JSON.stringify(paramObject))
    API.getData(paramObject, function(paramObject, response){
        console.log('response '+JSON.stringify(response));

        if (response.code == 200) { 
            scope.msg = "Password successfully reset";
            scope.msgClass = 'success';
        }
        else {
            scope.msg = "Password could not be reset";
            scope.msgClass = 'error';
        }
        scope.isInputDisabled = false;

    })
}
/* don't need this since nothing needs to be pre-loaded; use ng-app in index.html instead
// initialize endpoints API, Angular, and populate Angular model - called from registration.html google client apis onready
function init() {  

    angular.bootstrap(document.body, ['SelfService']);  // bootstrap Angular only once callback is complete: this replaces ng-app="Registration" in parent Div
 
} 
*/