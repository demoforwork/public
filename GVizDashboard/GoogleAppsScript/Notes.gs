/*
Defining pivot data dynamically in code and providing visualizations with the Google Visualization API supports dynamic response to new categories, broad sharing, and rich filtering.

The HTML defines the layout of the dashboard and placeholders for the controls and charts.

The Javascript defines the datatable, controls, and charts, and binds them together.

Because this is invoked from a Google Site or web page, it must be deployed as a Web App outside the spreadsheet container context.

Apps Script has two different ways to create user interfaces for web apps. For this sample, we'll use the newer HtmlService.

The doGet function is the one that is called when a user accesses your web app's URL. 
Before we can publish this as a web app, we must save a version of the project. Go to File > Manage versions, and save a version.

Run the Dashboard doGet() function from the code editor to authorize the project. Ignore the 'ReferenceError: "google" is not defined. (line 104, file "dashboardJs.html")'

Now you're ready to publish the web app. Go to Publish > Deploy as web app. This opens a dialog where you must make some choices about how to deploy your web app. Those choices are explained here. For this script, choose:
- Project version: 1
- Execute the app as: User accessing the web app
- Who has access to the app: up to you
- Then click the button to deploy the script. You'll be presented with a URL that you can copy and paste.
- Right-click copy and paste the URL below this ("latest code") into your browser.
*/