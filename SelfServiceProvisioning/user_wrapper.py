import json
import logging 

# new libraries
from googleapiclient import discovery

import properties
import service_utilities

logging.getLogger().setLevel(properties.log_level)

# retrieve this JSON: https://www.googleapis.com/discovery/v1/apis/admin/directory_v1/rest (which requires no authentication)
# and create a helper class for constructing further requests 
#DIRECTORY_SERVICE = build("admin", "directory_v1")  # admin refers to the admin sdk, not to the user

#class UserCrud():
class UserCrud(object):

#    def __init__(self, credentials):  
#       self.directory_service = discovery.build('admin', 'directory_v1', credentials=credentials) # initialize the class  

    # define get method
    def get_user(self, credentials, client_request):  
        #global DIRECTORY_SERVICE  # required to make Python look in module scope instead of local scope

        logging.info("***************************")
        logging.info("get user")
        logging.info("***************************")

        directory_service = discovery.build('admin', 'directory_v1', credentials=credentials)
        users = directory_service.users()

        @service_utilities.retry(Exception, tries=2)
        def get_user_retry():
            user = users.get(userKey=''.join([client_request.get('user'), '@', client_request.get('domain')])).execute()  # https://developers.google.com/admin-sdk/directory/v1/reference/users/list     
            return {'givenName': user['name']['givenName'], 'familyName': user['name']['familyName']}

        return get_user_retry()

    # define insert method
    def insert_user(self, credentials, client_request):  

        logging.info("***************************")
        logging.info("insert user")
        logging.info("***************************")

        # build the org path
        org_path_prefix = ''
        if properties.domain_server_obj[client_request.get('domain')]['orgPathPrefix'] != "":
            org_path_prefix = ''.join(['/',properties.domain_server_obj[client_request.get('domain')]['orgPathPrefix']])
        if client_request.get('org') == 'undefined':
            org_unit_path = ''.join([org_path_prefix,'/'])
        else:
            org_unit_path = ''.join([org_path_prefix,'/',client_request.get('org')])

        logging.info("org_path_prefix %s" % org_path_prefix)
        logging.info("org_unit_path %s" % org_unit_path)

        # provision user on domain
        usersresource = {
            "primaryEmail": ''.join([client_request.get('user'), '@', client_request.get('domain')]),
            "name": {
                "givenName": client_request.get('givenName'),
                "familyName": client_request.get('familyName'),
            },
            "password": client_request.get('password'),
            "orgUnitPath": org_unit_path,
            "suspended": False
        }
        directory_service = discovery.build('admin', 'directory_v1', credentials=credentials)
        users = directory_service.users()
        logging.info(usersresource)

        @service_utilities.retry(Exception)
        def insert_user_retry():
            return users.insert(body = usersresource).execute()

        return insert_user_retry()

    # define set password method
    def set_password(self, credentials, client_request):  

        logging.info("***************************")
        logging.info("set password")
        logging.info("***************************")

        usersresource = {
            "password": client_request.get('password')
        }
        directory_service = discovery.build('admin', 'directory_v1', credentials=credentials)
        users = directory_service.users()

        @service_utilities.retry(Exception)
        def set_password_retry():
            return users.update(userKey=''.join([client_request.get('user'), '@', client_request.get('domain')]), body = usersresource).execute()

        return set_password_retry()

    # define make admin method
    def make_admin(self, credentials, client_request):  

        logging.info("***************************")
        logging.info("make admin")
        logging.info("***************************")

        usersresource = {
            "status": True
        }
        directory_service = discovery.build('admin', 'directory_v1', credentials=credentials)
        users = directory_service.users()

        @service_utilities.retry(Exception)
        def make_admin_retry():
            return users.makeAdmin(userKey=''.join([client_request.get('user'), '@', client_request.get('domain')]), body = usersresource).execute()

        return make_admin_retry()