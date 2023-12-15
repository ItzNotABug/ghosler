## Ghosler - Ghost Newsletters 👻

**Ghosler** enables easy sending of newsletter using your own email and SMTP credentials when you are just starting
out & have a small to moderate user-base.

It is helpful for bypassing the limitations of the hardcoded Mailgun setup and supports tracking email deliverability
and opens, with the capability to use **multiple** email accounts.

##### Note:

1. Currently, only one newsletter is supported. **If you have multiple active newsletters, do not use this for now.**
2. The UI isn't too friendly on desktop as I do not have enough exp. in web, but gets the job done, if you are someone
   who can improve the UI, please contribute.

### Key Features

- **Support for Multiple Email Accounts**: Distribute newsletters through various email accounts, dividing member counts
  accordingly.
- **Tracking Email Performance**: Monitor email deliverability and open rates.
- **Customize Newsletter**: You can customize the newsletter via Settings, or go full on by providing
  a [custom template](#custom-template).
- **Paid & Free Members Management**: Ghosler shows a **Subscribe** button to members who do not have access to paid
  content.

### Running Ghosler

Pre-requisites: `Node 18^` & `pm2` installed.

1. Clone the project on your server.
2. Run `npm ci && pm2 start app.js --name ghosler` & you are done. Navigate to main site & edit required settings after
   completing the Setup instructions below.

### Setup Instructions

1. **Access Ghost Dashboard**: Navigate to your Ghost dashboard.
2. **Create Custom Integration**:
    - Go to **Settings** > **Advanced** > **Integrations**.
    - Click on **Add Custom Integration**.
    - Name the integration (e.g., Newsletters) and click **Add**.
    - **Copy** the **Admin API Key** displayed.
3. **Configure Ghosler**:
    - Fire up the Ghosler front-end by going to `https://your-domain.com`. Default `PORT` is `2369`.
    - Click on **Settings** button.
    - Click on **Ghost Settings** & add your **Ghost Site Url** & **Admin API Key**.
    - Add mail configurations in **Emails** section.
    - Change other settings you wish to and click **Save Changes**.
      Upon clicking **Save Changes**, Ghosler will automatically create a new `Webhook` in the Ghost Integration (if it
      doesn't already exist).
      This webhook enables **Ghosler** to receive information about posts when they are published.

Now as soon as you publish your Post, it will be sent to your Subscribers who have enabled receiving emails.

### Testing Configurations

Ghosler will always use a debug version of the configs i.e. `config.debug.json` if one exists. The JSON schema is the
same as in the [config.production.json](./config.production.json) file.

#### Custom Template

If you want to customize the newsletter template even more, follow the steps -

1. Create a **custom-template.ejs** in the root directory.
2. Customize it as you like, take a look at [pre-defined template](./views/newsletter.ejs) for reference.
3. That's it! Ghosler will use the new template for preview & sending newsletter.
4. Rename the file to anything if you don't want to use the custom template.

### TODOs

1. Add support for multiple newsletters.
2. Add feedback support in newsletter template.
3. Build a `CLI` to install, update & other options to manage Ghosler instance **[WIP]**.

#### And don't forget to `⭐` the project!