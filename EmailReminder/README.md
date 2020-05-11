# Gmail Reminder Nudges

## Usage

- Outbound: bcc. yourself with the number of days after which to followup (eg. yourmail+2@domain for a followup in 2 days).
- Inbound: same deal, but just forward to yourself with the number of days after which to followup.
- Missed inbound: set reminder periods by label for unread emails.
- A followup email will be automagically sent every x days (eg. 2 in the example above) until folks (including you) respond, excluding weekends and holidays.

Note that you can set up a [Gmail filter](https://medium.com/r/?url=https%3A%2F%2Fsupport.google.com%2Fmail%2Fanswer%2F7190%3Fhl%3Den%26vid%3D0-888618247892-1511488227725) to automatically label emails.


## Getting Started


### Prerequisites

This project is dependent on the [Google Apps Script](https://developers.google.com/apps-script/) environment.


### Installing

Upload the script with [clasp](https://developers.google.com/apps-script/guides/clasp#upload)

```
Configure your desired reminder messages, labels, frequency, page_size, and max_threads in the Config file (eg. 500 & 1000 for the latter two).
```
```
Run the  script once from the script editor to authorize it (from the Code file, Run -> Run Functions -> main)
```
```
Set a daily trigger for sendReminders (Edit -> Current Project's Triggers) once you're satisfied with its behaviour
```

## Running the tests

```
Set TEST to true; this enables zero day reminders.
```
```
Run the sendReminders() function from the Editor to test it.
```



## Built With

[Google Apps Script](https://developers.google.com/apps-script/)

## License

This project is licensed under the Apache License - see the [LICENSE.gs](LICENSE.gs) file for details
