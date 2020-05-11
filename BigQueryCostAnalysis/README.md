Overview
========
This Apps Script Spreadsheets tool retrieves execution and cost info for BigQuery jobs finished in the last 6 months; these costs are estimated based on query size and pricing and may not accurately reflect your billing.

* The user submitting the query must have view access on the project

Preview
=======
You can preview the functionality [here](https://docs.google.com/spreadsheets/d/13-zZhgoOvUKkmLGXYgaaN4fsw-kSglFSkYUU2NnPRD4/edit); use a test project to protect your confidentiality.

* You can delete your sheet after you're finished so it won't be visible to other users, but it can still be retrieved by the sheet owner through the revision history.


Instructions
============     
Specify the desired project under 'List Jobs' and submit to retrieve the list of jobs.

Select a range of job rows and select 'Get Job Details' to retrieve the queries and the users who submitted them.

* Re-order the rows to make those jobs contiguous for which you want the detail information; eg. sort by Dollars Billed and select the highest billing rows.

Deployment
==========
Add this script to a Google Spreadsheet as described [here](https://developers.google.com/apps-script/guides/bound#creating_a_bound_script)