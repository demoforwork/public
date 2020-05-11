log_level = 'WARNING'

test = true # set to True to enable test user and message_to
# over-rides for testing
test_user = '[TEST_USER]'
test_message_to = "[REAL_USER@YOUR_DOMAIN]" 

email_template_obj = {
            'createAccount': 
                  {'user': '[DOC_ID_1]', 
                  'admin': '[DOC_ID_2]'},
            'setPassword': 
                  {'user': '[DOC_ID_3]', 
                  'admin': '[DOC_ID_4]'}}

# customer domain information for javascript client UI
domain_client_arr = [
            {'domain': "[CUSTOMER_1_DOMAIN]", 
            'orgs': ["[CUSTOMER_1_ORG_1]","[CUSTOMER_2_ORG_2]"]}, 
            {'domain': "[CUSTOMER_2_DOMAIN]", 
            'orgs': []}, # empty orgs array will put users in the root of the domain
            {'domain': "[CUSTOMER_3_DOMAIN]", 
            'orgs': ["[CUSTOMER_3_ORG_1]","[CUSTOMER_3_ORG_2]"]}]

# customer domain information for server processing
domain_server_obj = {
            # subject_account must have privileges required for the operations the tool will perform on their behalf
            # at a minimum the subject_account must have User creation and Drive privileges (for email templates) for the orgs in the domain_client_arr
            # restrict this to just the required sub orgs for least privilege
            # if the provisioned users will have admin privileges on the domain, 
            # - set createAsAdmin flag to true
            # - the subject_account must have super-user privileges and have logged in to create admin
            # orgPathPrefix supports prefixed orgs
            '[CUSTOMER_1_DOMAIN]': 
                  {'subject_account': "[SERVICE_USER@CUSTOMER_1_DOMAIN]", # 
                  'orgPathPrefix': "",  
                  'notifyEmail': "[USER@CUSTOMER_1_DOMAIN]", 
                  'createAsAdmin': "false"},
            '[CUSTOMER_2_DOMAIN]': 
                  {'subject_account': "[SERVICE_USER@CUSTOMER_2_DOMAIN]", 
                  'orgPathPrefix': "",
                  'notifyEmail': "[USER@CUSTOMER_2_DOMAIN]", 
                  'createAsAdmin': "false"},
            '[CUSTOMER_3_DOMAIN]': 
                  {'subject_account': "[SERVICE_USER@CUSTOMER_3_DOMAIN]", 
                  'orgPathPrefix': "",
                  'notifyEmail': "[USER@CUSTOMER_3_DOMAIN]", 
                  'createAsAdmin': "false"}}                   

# must be an authorized user: https://cloud.google.com/appengine/docs/standard/python/mail/#who_can_send_mail
# eg. Any email address listed in the Cloud Platform Console under Email API Authorized Senders
sendmail_email = "[USER@DOMAIN]"  

target_key_json = "./key/service_account.json"

# get target service account email address and key through Dev Console -> API Access -> Create Client ID (https://code.google.com/apis/console)
target_service_account_email = "[SERVICE_ACCOUNT_EMAIL]" 

# drive template subject account email; this is a normal Cloud Identity / G Suite user being used as a service account
template_subject_account = "[SERVICE_USER@DOMAIN]" # must have Drive admin privileges

# scopes
# set at https://admin.google.com/AdminHome?chromeless=1#OGX:ManageOauthClients: should occur immediately
# scopes https://accounts.google.com/IssuedAuthSubTokens validates that they've been invoked

# target scopes for admin console: https://www.googleapis.com/auth/admin.directory.user,https://www.googleapis.com/auth/admin.directory.user.security,https://www.googleapis.com/auth/admin.directory.orgunit
# also has Drive scope for email templates: https://www.googleapis.com/auth/admin.directory.user,https://www.googleapis.com/auth/admin.directory.user.security,https://www.googleapis.com/auth/admin.directory.orgunit,https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/admin.directory.group
# the above aggregated scope is only because overloading one sub-domain as target and source; Drive scope would usually be on source domain only

target_scope = ("https://www.googleapis.com/auth/admin.directory.user",
                  "https://www.googleapis.com/auth/admin.directory.user.security",
                  "https://www.googleapis.com/auth/admin.directory.orgunit")                               

template_scope = "https://www.googleapis.com/auth/drive"
