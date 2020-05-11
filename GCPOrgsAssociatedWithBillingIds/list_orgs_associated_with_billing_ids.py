# List organizations of projects for which one of the viewers (or above, eg. owner/editor has been granted billing user role for the billing account associated with another org
# This only works if the viewers are members of the same org on which the domain-wide delegation has been configured

from googleapiclient import discovery
from google.oauth2 import service_account
from pprint import pprint

domain = '[DOMAIN_WHICH_OWNS_BILLING_ACCOUNTS]' # domain which owns billing accounts, and for which domain-wide delegation has been configured
organization = '[ORGANIZATION]' # numerical id
key_file = '[SERVICE_ACCOUNT_JSON_KEY_FILE]'
scope = ("https://www.googleapis.com/auth/cloudplatformorganizations.readonly","https://www.googleapis.com/auth/cloud-billing.readonly","https://www.googleapis.com/auth/cloudplatformprojects.readonly")
delegated_user = '[BILLING_ACCOUNT_ADMIN]' # id only (ie. without @domain) of the billing account admin on the main domain
subject = ''.join([delegated_user,'@',domain]);
delegated_credentials = service_account.Credentials.from_service_account_file(key_file, scopes=scope, subject=subject)


def get_item_fields(resp, respObject, field, **keyword_parameters):
	item_list = []
	item_page_list = resp[respObject]
	for item in item_page_list:
		if 'filter_item' in keyword_parameters:
			if item[keyword_parameters['filter_item']] == keyword_parameters['filter_value']:
				item_list.append(item[field])
		else:
			item_list.append(item[field])
	
	return item_list

def get_orgs(resp, respObject, field, ancestorType):
	item_list = []
	item_page_list = resp[respObject]
	for item in item_page_list:
		if item[field]['type'] == ancestorType:
			item_list.append(item[field]['id'])

	return item_list

########################
print "*** Org level User Billing Accounts ****"
authorized_service = discovery.build('cloudresourcemanager', 'v1', credentials=delegated_credentials)

org_billing_user_list = []
org = ''.join(['organizations/',organization])
print org

get_iam_policy_request_body = {
    # TODO: Add desired entries to the request body.
}

req = authorized_service.organizations().getIamPolicy(resource=org, body=get_iam_policy_request_body)
resp = req.execute()

try:
    next_page_token = resp['nextPageToken']
except:
	next_page_token = False

org_billing_user_page_list = get_item_fields(resp, 'bindings','members', filter_item='role', filter_value='roles/billing.user') 
if org_billing_user_page_list:
	org_billing_user_list.extend(org_billing_user_page_list[0]) # the resp object is already in an array

while next_page_token is True:
	resp = req.execute(pageToken=next_page_token)
	org_billing_user_page_list = get_item_fields(resp, 'bindings','members', filter_item='role', filter_value='roles/billing.user') 
	if org_billing_user_page_list:
		org_billing_user_list.extend(org_billing_user_page_list[0]) # the resp object is already in an array
		next_page_token = resp['nextPageToken']


pprint(org_billing_user_list)

########################
print "*** Org billing accounts for which principal user has view role ****"
# get users who've been inherited as billing users

authorized_service = discovery.build('cloudbilling', 'v1', credentials=delegated_credentials)

billing_account_list = []
req = authorized_service.billingAccounts().list()
resp = req.execute()

try:
    next_page_token = resp['nextPageToken']
except:
	next_page_token = False

billing_account_page_list = get_item_fields(resp, 'billingAccounts', 'name')  
billing_account_list.extend(billing_account_page_list)

while next_page_token is True:
	resp = req.execute(pageToken=next_page_token)
	billing_account_page_list = get_item_fields(resp, 'billingAccounts', 'name') 
	billing_account_list.extend(billing_account_page_list)
	next_page_token = resp['nextPageToken']

pprint(billing_account_list)

########################
print '*** Billing account users and projects, including inherited users ***'
# get users who've been directly assigned roles on the billing account
# and projects which are assigned to this billing account

billing_account_dictionary = {}
for billing_account in billing_account_list: 
	policy_list = [] # re-initialize to inherited users for each billing account
	try: # may not have permission on all billing accounts, though should
		req = authorized_service.billingAccounts().getIamPolicy(resource=billing_account)
		resp = req.execute()

		try:
		    next_page_token = resp['nextPageToken']
		except:
			next_page_token = False

		policy_page_list = get_item_fields(resp, 'bindings','members', filter_item='role', filter_value='roles/billing.user') 
		if policy_page_list:
			policy_list.extend(policy_page_list[0]) # the resp object is already in an array

		while next_page_token is True:
			resp = req.execute(pageToken=next_page_token)
			policy_page_list = get_item_fields(resp, 'bindings','members', filter_item='role', filter_value='roles/billing.user') 
			if policy_page_list:
				policy_list.extend(policy_page_list[0]) # the resp object is already in an array
				next_page_token = resp['nextPageToken']
	except:
		continue
	
	if policy_list:
		billing_account_dictionary[billing_account] = {}
		billing_account_dictionary[billing_account]['users'] = policy_list

		project_list = []
		try: # may not have permission on all billing accounts, though should
			req = authorized_service.billingAccounts().projects().list(name=billing_account)
			resp = req.execute()

			try:
			    next_page_token = resp['nextPageToken']
			except:
				next_page_token = False

			project_page_list = get_item_fields(resp,'projectBillingInfo','projectId')
			project_list.extend(project_page_list)

			while next_page_token is True:
				resp = req.execute(pageToken=next_page_token)
				project_page_list = get_item_fields(resp,'projectBillingInfo','projectId')
				project_list.extend(project_page_list)
				next_page_token = resp['nextPageToken']
		except:
			continue
		if project_list:
			billing_account_dictionary[billing_account]['users'].extend(org_billing_user_list) # add inherited users
			billing_account_dictionary[billing_account]['projects'] = project_list



pprint(billing_account_dictionary)

########################

print '*** Orgs associated with the billing accounts ***'

authorized_service = discovery.build('cloudresourcemanager', 'v1', credentials=delegated_credentials)

get_ancestry_req_body = {
    # TODO: Add desired entries to the req body.
}

org_list = []
for billing_account in billing_account_dictionary: # only care about billing accounts for which users have been allocated
	for project_id in billing_account_dictionary[billing_account]['projects']: 
		for user in billing_account_dictionary[billing_account]['users']: 
			# impersonate each of the users to which billing has been delegated for this billing id, 
			# since one of them should have rights to get the project's parent org
			# this will fail for users who aren't members of the domain for which domain-wide delegation has been configured
			if user.split('@')[1] == domain:
				subject = user
				delegated_credentials = service_account.Credentials.from_service_account_file(key_file, scopes=scope, subject=subject)
				try: # may not have permission on all projects, though should
					req = authorized_service.projects().getAncestry(projectId=project_id, body=get_ancestry_req_body)
					resp = req.execute()

					try:
					    next_page_token = resp['nextPageToken']
					except:
						next_page_token = False

					org_page_list = get_orgs(resp,'ancestor','resourceId','organization')
					if org_page_list:
						org_list.extend(org_page_list)

					while next_page_token is True:
						resp = req.execute(pageToken=next_page_token)
						org_page_list = get_orgs(resp,'ancestor','resourceId','organization')
						if org_page_list:
							org_list.extend(org_page_list)
						next_page_token = resp['nextPageToken']
				except:
					continue

unique_orgs = set(org_list)
pprint(unique_orgs)