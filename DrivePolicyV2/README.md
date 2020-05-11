# Google Drive Policy Monitoring And Remediation v2

Ever found out that files or folders are inadvertently shared with a customer or partner?

Use this utility to detect, notify of, and remediate Drive folder and file permissions which are out of policy; it does not apply to Team Drives. 

- It works along [Forseti](https://github.com/GoogleCloudPlatform/forseti-security) lines by allowing you to define desired sharing policy by folder and domain and then reconciling against this; policy is inherited downwards to match Drive's inheritance.
- Configuration switches allow you to remediate permissions or just notify

This version provides the following enhancements over the [earlier version](https://github.com/demoforwork/public/tree/master/DrivePermissionsScrubber):

- It doesn't report false positives for files with multiple ancestors, one of which has the required permissions.
- It's fast, and therefore scalable to much larger folder structures: it takes 10s of seconds to do what took the prior version half an hour.
- Policy is defined in a spreadsheet rather than code, which makes it much easier to update, particularly for a team.


Please test it for unexpected edge-case behaviours.

Good extensions would be to:

- Support policy based on Google Groups as well as domains.
- Support Team Drives.
- Push the notification map to a sheet so you can scan hourly and only notify daily.

More information on this utility [here](https://medium.com/@fargyle/google-drive-policy-monitoring-and-remediation-v2-1faed83105b9)


## Getting Started


### Prerequisites

This project is dependent on 

- [Golang](https://golang.org/)
- [G Suite](https://gsuite.google.com/)
- [Google Cloud Platform](https://cloud.google.com/)

#### Policy Spreadsheet
Create a Google folder policy spreadsheet with one header row and two columns:

- Folder ids
- Permitted domains

Define a range for these two columns, and call it "PolicyRange"; the header row names don't matter.

Policy tips:

- List your host domain against the root folder
- List a folder id multiple times if multiple domains are permitted
- Use the 'public' keyword in the domain field for folders whose files can be shared with anyone who has the link


#### OAuth Credential
[Create an OAuth credential](https://cloud.google.com/console/apis/credentials) and download it. 

In the [OAuth consent screen](https://cloud.google.com/console/apis/credentials/consent) 

- ensure it's public
- name it something meaningful, eg. Drive Policy Validator

#### Cloud Libraries
[Enable the following libraries](https://cloud.google.com/console/apis/library)

- Google Drive API
- Google Sheets API
- Stackdriver Logging API


### Installing

- Clone the go script and templates
- Get the required go libraries
- Copy [this folder](https://github.com/demoforwork/public/tree/master/oauth) into the parent src directory
- Build the code
- Ensure your code directory isn't shared
- Copy the credential file to your code directory and remove it from the download directory
- Run the utility without any flags for help


## Running the tests

Test the utility against a test folder hierarchy with known permissions

- Omit the -f (fix) flag until you've refined your policy


## Built With

[Golang](https://golang.org/)

## License

This project is licensed under the Apache License - see the [LICENSE](LICENSE) file for details