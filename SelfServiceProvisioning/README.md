# User Self-service Provisioning
Need to enable customers to provision Google Cloud or G Suite identities from a SaaS application?

This sample application illustrates how to provision identities to a designated alternate domain from a host domain.

### Additional Features:
The application...
- sends confirmation messages based on Docs templates when a new user is created
- includes an API for confirming that users were successfully provisioned

### Key Concepts
There are two sets of domains, each with their own scopes (see properties.py)
- The Docs templates would reside on your main domain
- The provisioning occurs on the sub-domain corresponding to the customer

If you just want to test out provisioning, the key code is:
```
from googleapiclient import discovery
from google.oauth2 import service_account
SCOPES = ("https://www.googleapis.com/auth/admin.directory.group","https://www.googleapis.com/auth/admin.directory.user")
SUBJECT = '[SERVICE_USER@DOMAIN]'

target_key_file = '[YOUR_KEY_FILE.JSON]'
credentials = service_account.Credentials.from_service_account_file(target_key_file)
scoped_credentials = credentials.with_scopes(SCOPES)
delegated_credentials = scoped_credentials.with_subject(SUBJECT)

admin_client = discovery.build('admin', 'directory_v1', credentials=delegated_credentials)
req = admin_client.users().list(domain='workshop1.cloud-eval.com')
resp = req.execute()
users = resp['users']
print users
```

## Getting Started

### Prerequisites

This project is dependent on [Google App Engine Standard Python 2.7](https://cloud.google.com/appengine/docs/standard/python/).


### Installing

Configure the Host Domain
- Enable the required APIs (eg. Admin SDK, Drive) on the Google Cloud project to which you’ll deploy this
- Create a service account on the project and download the service account key in JSON format 
- Authorize the service account for the required scopes using the correct client id (IAM & admin -> Service accounts -> View Client ID)
- Create a user on your domain which will act as the sub for the service account on G Suite: give it the required roles (eg. manage users on a particular org); see service_utilities.py to understand how it's used.
- Create authorized credentials using the key and the authorized user together 
- Create Docs email templates 

Configure the Application
- Modify the properties.py and index.html files to suit your environment (primarily domain, new keys and accounts, new email templates).  
- Create appropriate Cloud Identity subdomains and modify properties.py to suit
- Create appropriate sub-orgs within these and modify properties.py to suit


### Hardening code for production
- Update Angular to latest version
- Update Bootstrap to latest version
- Store key file in secure storage like Google Cloud Storage rather than on file system
- Secure connection between client and server: current assumption is that users will have a Google identity which can be verified, but that won’t be the case for 3rd party users
- Update properties file to suit your environment
- Set the subdomain based on your SSO or other identity solution rather than letting the user select
- The subdomain username is currently either being set to a hard-coded value from the properties file (in test mode) or it's setting the subdomain username to the same name as the user running this has on the domain on which the tool is being run
-- For production use you'll want to tie this into your SSO or other identity solution


### Possible bugs
Mail functionality hasn't been tested since this was anonymized, so mail may throw some errors when you deploy.

## Running the tests

The test flag is set so it will run from App Server local dev environment; it won't actually send emails unless you're deployed to appspot.

### Test locally
```
http://localhost:8080
```
Validate that the user was provisioned
```
http://localhost:8080/api/getUser?domain=[YOUR_HOST_PROJECT]&user=[TEST_USER]
```
### Deploy
Make sure config account and project are set properly
```
gcloud app deploy --version 1 --project [YOUR PROJECT ID]
```



## Built With

[Google App Engine Standard Python 2.7](https://cloud.google.com/appengine/docs/standard/python/).

## License

This project is licensed under the Apache License - see the [LICENSE](LICENSE) file for details.



