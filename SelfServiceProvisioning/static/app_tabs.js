angular.module('SelfService', ['components'])  // tab component 

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
        $http.get(restAPI).then(function onSuccess(response) {
            callback(paramObject, response.data)});
      }
    }
  })

 .controller('MainCtrl', ['$scope','API', 
   
    function (scope, API) {  
        var paramObject = {endpoint:'getProperties', args: ''};
        API.getData(paramObject, function(paramObject, response){
        console.log('response '+JSON.stringify(response));
        scope.domainArr = [];

        scope.master = {};

        scope.reset = function() {
          scope.user = angular.copy(scope.master);
        };

        if (response.code == 200) {
            scope.userNamePassword = scope.userNameAccount = scope.userName = response.payload.userName;
            var domainArr = response.payload.domains;
            var domainArrLen = domainArr.length;
            for (var i=0;i<domainArrLen;i++) {
                scope.domainArr.push(domainArr[i].domain);
            }           
        }

        })

        scope.setUserNameDisp = function(tab,type) {
            if (tab == 'createAccount' && type == 'main') {
                scope.userNameAccount = scope.userName;
            }
            else if (tab == 'createAccount' && type == 'demo') {
                scope.userNameAccount = 'd_' + scope.userName;
            }
            else if (tab == 'setPassword' && type == 'main') {
                scope.userNamePassword = scope.userName;
            }
            else if (tab == 'setPassword' && type == 'demo') {
                scope.userNamePassword = 'd_' + scope.userName;
            }
        };
    }

  ])

/* don't need this since nothing needs to be pre-loaded; use ng-app in index.html instead
// initialize endpoints API, Angular, and populate Angular model - called from registration.html google client apis onready
function init() {  

    angular.bootstrap(document.body, ['SelfService']);  // bootstrap Angular only once callback is complete: this replaces ng-app="Registration" in parent Div
 
} 
*/