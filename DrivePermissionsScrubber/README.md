# Google Drive Permissions Scrubber

Ever found out that files or folders are inadvertently shared with a customer or partner?

Use the Drive permissions scrubber to detect, notify of, and remediate folder and file permissions. 
- It works along [Forseti](https://github.com/GoogleCloudPlatform/forseti-security) lines by allowing you to define desired sharing policy by folder and domain and then reconciling against this; policy is inherited downwards to match Drive's inheritance.
- Configuration switches allow you to remove permissions or just notify
- Please test it for unexpected edge-case behaviours

A good extension would be to push the notification object to a sheet or script permissions so you can scan hourly and only notify daily.



## Getting Started


### Prerequisites

This project is dependent on the [Google Apps Script](https://developers.google.com/apps-script/) environment.


### Installing

Upload the script with [clasp](https://developers.google.com/apps-script/guides/clasp#upload)

```
Configure your desired folder permissions and switches
```
```
Run the  script once from the script editor to authorize it (from the Code file, Run -> Run Functions -> main)
```
```
Set an hourly or daily trigger once you're satisfied with its behaviour
```

## Running the tests

```
Set the permissions removal switches to false; this simplifies re-running tests.
```
```
Run the main() function from the Editor to test it.
```



## Built With

[Google Apps Script](https://developers.google.com/apps-script/)

## License

This project is licensed under the Apache License - see the [LICENSE.gs](LICENSE.gs) file for details
