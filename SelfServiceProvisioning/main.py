# configuration settings
import properties

#from apiclient.discovery import build
from google.appengine.api import users
import time
import json
import logging
import webapp2

# http (for urlfetch) and google api client imports
import httplib2
import sys
from oauth2client.client import SignedJwtAssertionCredentials

# new libraries: vendor in through appengine_config.py 
# https://github.com/GoogleCloudPlatform/google-auth-library-python/issues/169
# https://github.com/GoogleCloudPlatform/google-auth-library-python/tree/master/google
from google.oauth2 import service_account
from googleapiclient import discovery

# G Suite API wrappers
import drive_wrapper
import mail_wrapper
import user_wrapper
import service_utilities



logging.getLogger().setLevel(properties.log_level)

f = file(properties.target_key_file, "rb") # b reads file in binary mode; not strictly necessary, but safer to avoid strange Windows EOL characters: http://stackoverflow.com/questions/9644110/difference-between-parsing-a-text-file-in-r-and-rb-mode
target_key = f.read()
f.close()

class API(webapp2.RequestHandler): # self.request contains the arguments passed from the client
    def __init__(self, request, response):
        # need this because the API inherits from webapp2.RequestHandler, and it expects three arguments to init
        # http://stackoverflow.com/questions/576169/understanding-python-super-with-init-methods
        super(API, self).__init__(request, response)

        self.scoped_credentials = service_account.Credentials.from_service_account_file(
            properties.target_key_json, 
            scopes = properties.target_scope
            )

        self.user_crud = user_wrapper.UserCrud()
        self.mail_send = mail_wrapper.MailSend()
        self.drive_crud = drive_wrapper.DriveCrud()   

    def get_properties(self):
        #http://stackoverflow.com/questions/12664696/how-to-properly-output-json-with-app-engine-python-webapp2/12664865#12664865
        # Checks for active Google account session
        if properties.test:
            user = True # for testing
        else:
            user = users.get_current_user()

        if not properties.domain_client_arr: 
            obj = {
                'code': 204, 
                'msg': 'No properties'
                } 
        else: 
            if not user: 
                obj = {
                    'code': 204, 
                    'msg': 'No user session'
                    } 
            else:
                if properties.test:
                    obj = {
                    'code': 200, 
                    'payload': {'userName': properties.test_user, 'domains': properties.domain_client_arr} # for testing
                    } 
                else:
                     obj = {
                    'code': 200, 
                    'payload': {'userName': user.nickname(), 'domains': properties.domain_client_arr}
                    }            
        self.response.out.write(json.dumps(obj))

    def get_user(self):   # request won't be used since an instance of VoidMessage

        try:
            delegated_credentials = self.scoped_credentials.with_subject(properties.domain_server_obj[self.request.get('domain')]['subject_account'])  
            userObj = self.user_crud.get_user(delegated_credentials, self.request)
            obj = {
                'code': 200, 
                'payload': {'domain': self.request.get('domain'), 'user': self.request.get('user'), 'givenName': userObj['givenName'], 'familyName': userObj['familyName']}
                } 
        except:
            #pass
            obj = {
                'code': 204, 
                'msg': ' '.join(['User', self.request.get('user'), 'not found on domain',self.request.get('domain')])
            } 

        #http://stackoverflow.com/questions/12664696/how-to-properly-output-json-with-app-engine-python-webapp2/12664865#12664865
        self.response.headers['Content-Type'] = 'application/json'          
        self.response.out.write(json.dumps(obj))

    def insert_user(self):

        is_unauthorized_request = self.is_unauthorized_request()
        if is_unauthorized_request:
            obj = is_unauthorized_request
        else:
            try:
                delegated_credentials = self.scoped_credentials.with_subject(properties.domain_server_obj[self.request.get('domain')]['subject_account'])  
                userObj = self.user_crud.insert_user(delegated_credentials, self.request)
                obj = {
                    'code': 200, 
                    'msg': ' '.join(['User', self.request.get('user'), 'successfully added to domain',self.request.get('domain')])
                    } 
                if properties.domain_server_obj[self.request.get('domain')]['createAsAdmin'] == 'true':
                    logging.info('create as admin')
                    # time.sleep(2)  # pause x seconds to allow time for account to be provisioned
                    try:
                        userObj = self.user_crud.make_admin(delegated_credentials, self.request)
                        obj = {
                            'code': 200, 
                            'msg': ' '.join(['User', self.request.get('user'), ' successfully added to domain',self.request.get('domain'),'and made Admin'])
                            } 
                        # send confirmation emails 
                        subject = ' '.join(['Account', self.request.get('user'), 'on', self.request.get('domain'), 'was created'])
                        to = ''.join([self.request.get('requestor'),'@',self.request.get('domain')])
                        self.mail_send.send_mail(target_key, 'createAccount', 'user', self.request, to, subject) 
                        to = properties.domain_server_obj[self.request.get('domain')]['notifyEmail']
                        self.mail_send.send_mail(target_key, 'createAccount', 'admin', self.request, to, subject)
                    except:
                        obj = {
                            'code': 204, 
                            'msg': ' '.join(['User', self.request.get('user'), ' successfully added to',self.request.get('domain'),"but couldn't be made Admin"])
                            } 

                else:
                    # send confirmation emails 
                    subject = ' '.join(['Account', self.request.get('user'), 'on', self.request.get('domain'), 'was created'])
                    to = ''.join([self.request.get('requestor'),'@',self.request.get('domain')])
                    self.mail_send.send_mail(target_key, 'createAccount', 'user', self.request, to, subject)  
                    to = properties.domain_server_obj[self.request.get('domain')]['notifyEmail']
                    self.mail_send.send_mail(target_key, 'createAccount', 'admin', self.request, to, subject)  

            except:
                obj = {
                    'code': 204, 
                    'msg': ' '.join(['User', self.request.get('user'), ' could not be added to domain',self.request.get('domain')])
                    } 

        #http://stackoverflow.com/questions/12664696/how-to-properly-output-json-with-app-engine-python-webapp2/12664865#12664865
        self.response.headers['Content-Type'] = 'application/json'   
        self.response.out.write(json.dumps(obj))


    def set_password(self):
        
        is_unauthorized_request = self.is_unauthorized_request()
        if is_unauthorized_request:
            obj = is_unauthorized_request
        else:
            try:
                delegated_credentials = self.scoped_credentials.with_subject(properties.domain_server_obj[self.request.get('domain')]['subject_account'])  
                userObj = self.user_crud.set_password(delegated_credentials, self.request)
                obj = {
                    'code': 200, 
                    'msg': ' '.join(['Password set successfully',self.request.get('domain')])
                    } 

                # send confirmation emails 
                subject = ' '.join(['Password for account', self.request.get('user'), 'on', self.request.get('domain'), 'was changed'])
                to = ''.join([self.request.get('requestor'),'@',self.request.get('domain')])
                self.mail_send.send_mail(target_key, 'setPassword', 'user', self.request, to, subject) 
                to = properties.domain_server_obj[self.request.get('domain')]['notifyEmail'] 
                self.mail_send.send_mail(target_key, 'setPassword', 'admin', self.request, to, subject)  
            except:
                obj = {
                    'code': 204, 
                    'msg': ' '.join(['Password could not be set',self.request.get('domain')])
                    }           

        #http://stackoverflow.com/questions/12664696/how-to-properly-output-json-with-app-engine-python-webapp2/12664865#12664865
        self.response.headers['Content-Type'] = 'application/json'   
        self.response.out.write(json.dumps(obj))

    # check that the user is authorized to manage this account to prevent unauthorized account management via direct URL invocation
    def is_unauthorized_request(self):

        if properties.test:
            return False
        else:
            user = users.get_current_user()
            appengine_user = user.nickname()
            request_user = self.request.get('user')
            if appengine_user == request_user or ''.join(['d_',appengine_user]) == request_user:
                return False
            else:
                return {
                        'code': 403, 
                        'msg': ' '.join(['User',appengine_user,'is not authorized to manage the requested account:',request_user])
                        }
                


app = webapp2.WSGIApplication([
    webapp2.Route('/api/getProperties', handler=API, handler_method='get_properties'),
    webapp2.Route('/api/getUser', handler=API, handler_method='get_user'),
    webapp2.Route('/api/insertUser', handler=API, handler_method='insert_user'),
    webapp2.Route('/api/setPassword', handler=API, handler_method='set_password')
], debug=True)

