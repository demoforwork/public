
![Simulation](./Explorer%20for%20Google%20Groups.png)

# Explorer for Google Groups

Ever bumped into the Google [admin-managed Groups](https://support.google.com/a/answer/33343) parent [limits](https://support.google.com/a/answer/6099642?hl=en#membershiplimits)?

Use this utility to proactively check whether you're getting close to these limits, and to understand hotspots.

- It provides a visualizer as well as CSVs for offline analysis
- Batch mode enables you to run it at low load times and analyze the cached results later

## Considerations

The utility does not include group ownerships, which do count towards the quota; there isn't a way to do this other than scanning the entire groups tree.  

Each edge joining a child via multiple groups to a single parent (ie. diamond patterns) is counted; the actual Groups limits may be calculated differently for some children.

Please test the utility to confirm that it counts groups as you'd expect.


## Getting Started

### Prerequisites

[Cloud Identity admin roles](https://support.google.com/a/answer/2405986?hl=en)

- Super Admin privilege: for domain-wide delegation (the domain wide delegation role doesn't grant the required UI access, though it may work via API)
- Groups Admin identity: identity is used for runtime auth

Cloud roles

- [Service Account Admin](https://support.google.com/a/answer/2405986?hl=en) privilege

This project is dependent on 

- [Golang](https://golang.org/)
- [G Suite](https://gsuite.google.com/)
- [Google Cloud Platform](https://cloud.google.com/)


### Service Accounts
#### How-to
[Create service accounts](https://cloud.google.com/console/iam-admin/serviceaccounts) with JSON keys and download these; don't grant any IAM roles.

- Use more service accounts to distribute the Admin SDK query load if you run into query quota exceeded issues: some of the query quotas are per user (others are per domain, so this load balancing won't resolve all issues).

- [Edit the service accounts](https://cloud.google.com/console/iam-admin/serviceaccounts/details/) and 
    - note the unique id for the next step
    - expand "Show domain-wide delegation" and enable it


[Delegate authority to the service accounts](https://admin.google.com/AdminHome?chromeless=1#OGX:ManageOauthClients) for the following scopes; use the unique ids you'd noted earlier as the client name:

- https://www.googleapis.com/auth/admin.directory.group.member.readonly
- https://www.googleapis.com/auth/admin.directory.group.readonly

It may take a few minutes for this to take effect.

Note that granting larger scopes (ie. not readonly) will cause the program to fail with a 500 error; intuitively, you might think that granting a superset of the required scopes would work.

#### Documentation
- [Creating service accounts](https://cloud.google.com/iam/docs/creating-managing-service-accounts#creating)
- [Creating keys](https://cloud.google.com/iam/docs/creating-managing-service-account-keys)
- [Domain-wide delegation of authority](https://developers.google.com/admin-sdk/directory/v1/guides/delegation)


### Cloud Libraries
[Enable the Admin SDK](https://console.cloud.google.com/apis/library/admin.googleapis.com) library


### Installing

- Clone/pull this repo
- Create the required directories (GitHub doesn't honor empty directories) under output
    - output/CSV
    - output/JSON/parents
    - output/JSON/search 
- Get the required go libraries
- Build the code
- Ensure your credentials directory isn't shared
- Copy the service account keys to your credentials directory and remove them from the download directory

### Command examples
Run the utility without any flags for help

#### Batch
```
./groupCount [your-domain] [your-groups-admin-id] -p=batch -v=parents [user-email1] [user-email2]
```
```
./groupCount [your-domain] [your-groups-admin-id] -p=batch -v=search [group-prefix1] [group-prefix2]
```

#### Interactive
```
./groupCount [your-domain] [your-groups-admin-id]] -p=interact
```
Zoom: use the mouse wheel, or the keyboard +/-, in addition to the screen buttons

### Running the tests

Test the utility against a groups hierarchy with known counts

- Add service account keys and/or a -w (wait) flag if the utility exceeds the Groups API throughput limits

### Visualization
```
localhost:8080
```
- Hover on a node to see the group's domain, and parent counts
- Select a node to highlight its direct parents


## Built With

[Golang](https://golang.org/)
[vis.js](https://visjs.org/)
[jQuery](https://jquery.com/)
[jQuery UI](http://jqueryui.com)

## License

This project is licensed under the Apache License - see the [LICENSE](LICENSE) file for details

## Known issues

- The network visualization traps hyphens as signals to zoom out, so they can't be entered in the search field; workaround is to either 
    - enter a hyphen elsewhere (eg. text editor or browser bar) and copy/paste it into the search field
    - enter as unicode (eg. [on Mac](https://apple.stackexchange.com/questions/339738/how-do-you-type-a-character-with-its-ascii-code))
- Inverting the tree colors some of the nodes as if they'd been selected
- Error trapping is incomplete
- The error message when a queried group doesn't exist is incorrect, returns "No matching saved graphs or searches"
