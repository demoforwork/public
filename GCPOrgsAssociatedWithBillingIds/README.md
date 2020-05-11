# List GCP orgs associated with billing ids

List parent organizations of projects for which one of the viewers (or above, eg. owner/editor) has been granted billing user role for the billing account associated with another org.

This only works if the viewers are members of the same org on which the domain-wide delegation has been configured.


## Getting Started

### Prerequisites

#### Python and Python libraries
This utility is dependendent on Python and the following GCP and Google API libraries:
- [googleapiclient](https://github.com/google/google-api-python-client/tree/master/googleapiclient)
- google.oauth2

#### Domain-wide delegation
[Domain-wide delegation](https://developers.google.com/admin-sdk/directory/v1/guides/delegation)  enables services to perform actions on behalf of users.  Despite the branding, it applies to Google Cloud Platform APIs as well.

From the [Cloud Console](cloud.google.com/console), create a service account with *domain-wide delegation privileges* and download the JSON key. 
- Create it from the [IAM & admin -> Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts) screen (ie. not the API -> Credentials screen) or the domain-wide delegation privileges won't be available
- In production you'll want to store this in a secure store such as GCS rather than on your file system; it's easy to inadvertently upload the key along with the source, and once it's on GitHub it's difficult to remove an old version of the source.
- Note the Client ID: there are a bunch of IDs... the one you want is from the Manage Service Accounts -> View Client ID screen...or just grab it directly from the downloaded JSON file

From the [Cloud Identity Admin console](admin.google.com), log in as a super user; super user role is required since you can grant full Admin SDK permissions to a service account through these settings, which would otherwise constitute escalation of privileges.
- Using the id you noted earlier, [authorize the service account](https://developers.google.com/admin-sdk/directory/v1/guides/delegation#delegate_domain-wide_authority_to_your_service_account) you created in GCP for the required scopes, ie. https://www.googleapis.com/auth/cloudplatformorganizations.readonly, https://www.googleapis.com/auth/cloudplatformprojects.readonly, https://www.googleapis.com/auth/cloud-billing.readonly
- Do this from the Security -> Advanced Settings -> Manage Client API Access screen

### Installing

Download the file

Configure your desired domain, organization, and JSON key file in the script

Run the script:
```
$ python list_orgs_associated_with_billing_ids.py
```



## Built With

Python

## License

This project is licensed under the Apache License - see the [LICENSE.gs](LICENSE.gs) file for details