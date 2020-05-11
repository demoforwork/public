import logging 

from apiclient import errors

from google.appengine.api import mail

# new libraries
from google.oauth2 import service_account
from googleapiclient import discovery


import properties

# Apps API wrappers
import drive_wrapper
import service_utilities

logging.getLogger().setLevel(properties.log_level)

class MailSend():

    def __init__(self):
   
        #self.authorized_http = service_utilities.AuthorizedHttp()  # initialize the class 
        self.credentials = service_account.Credentials.from_service_account_file(
            properties.target_key_json, 
            scopes = properties.template_scope,
            subject = properties.template_subject_account
            )

        self.drive_crud = drive_wrapper.DriveCrud()  

    def send_mail(self, target_key, action, recipient, client_request, to, subject):


        logging.info("***************************")
        logging.info("send mail")
        logging.info("***************************")

        doc_id = properties.email_template_obj[action][recipient]

        # initialize items which may not be used in this email template so replace doesn't fail
        template_placeholders = ['requestor','domain','org','user','password','givenName','familyName']
        request = {}
        for item in template_placeholders:
            try: 
                request[item] = client_request.get(item)
            except KeyError: 
                request[item]  = ''   

        # get the template from Drive
        #template_user_http = self.authorized_http.GetHttpObj(properties.target_service_account_email,target_key, properties.template_subject_account, properties.template_scope) # normal user on template domain 
  
        body_html = self.drive_crud.get_file(self.credentials, doc_id) 
        if body_html is not None:
            #construct the email

            message = mail.EmailMessage(sender=properties.sendmail_email,
                                        subject=subject)

            if properties.test:
                message.to = properties.test_message_to # over-ride for testing
            else:
                message.to = to

            body_html = body_html.replace("{{requestor}}",request['requestor']).replace("{{domain}}",request['domain']).replace("{{user}}",request['user']).replace("{{password}}",request['password']).replace("{{givenName}}",request['givenName']).replace("{{familyName}}",request['familyName'])
           
            introMsg = ''
            adminMsg = ''
            orgMsg = ''
            if action == 'createAccount':
                if recipient == 'user':
                    introMsg = "For more information on how to log into the domain, please contact your administrator"
                if properties.domain_server_obj[request['domain']]['createAsAdmin'] == 'true':
                    if recipient == 'user':
                        adminMsg = "Your account was given super admin privileges.... PLEASE USE WITH CAUTION!"
                    else: # admin
                        adminMsg = "The account was given super admin privileges."
                if request['org'] != 'undefined':
                    orgMsg = ' '.join(["The account was placed in the",request['org'],"organization in the domain."])

            body_html = body_html.replace("{{introMsg}}",introMsg).replace("{{adminMsg}}",adminMsg).replace("{{orgMsg}}",orgMsg)

            message.html = ''.join(["<html><head></head><body>", body_html, "</body></html>"])

            message.send()

