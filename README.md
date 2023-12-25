## Ghosler - Ghost Newsletters 👻

**Ghosler** enables easy sending of newsletters using your own email and SMTP credentials.\
This is ideal when you are just starting out and have a small to moderate user base.

It is helpful for bypassing the limitations of the hardcoded Mailgun setup and supports many analytical features, along
with the capability to use **multiple** email accounts.

##### Note:

1. Currently, `Ghosler` supports only one newsletter at this time. **Please avoid using it if you manage multiple active
   newsletters**.

### Key Features

- **Support for Multiple Email Accounts**: Distribute newsletters through various email accounts, dividing member counts
  accordingly.
- **Tracking Email Performance**: Monitor email deliverability and open rates.
- **Customize Newsletter**: You can customize the newsletter via Settings, or go full on by providing
  a [custom template](#custom-template).
- **Paid & Free Members Management**: Ghosler shows a **Subscribe** button to members who do not have access to paid
  content.
- **URL Click Tracking in Emails**: Ghosler supports tracking URL clicks in the email, providing more insights on how
  your members are interacting with added links.
- **Newsletter Post Feedback**: Gain insights into reader preferences with detailed feedback on each post, including
  likes, dislikes, and overall sentiment.

### Running Ghosler

Pre-requisites: `Node 18^` & `pm2` installed.

1. Install the `CLI` -

   ```npm
   npm install -g ghosler-cli
   ```

2. Go to the directory you want to install `Ghosler`, make sure its empty & run below command -

   ```shell
   ghosler install
   ```
   Now navigate to main site & edit required settings after completing the Setup instructions below.

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

Ghosler defaults to using a debug configuration file, `config.debug.json`, if it exists. The structure of this file is
identical to that in [config.production.json](./config.production.json) file.

**Local Builds:**
Make sure to execute -

   ```shell
    npm run buildcss
   ``` 

to generate a minified css if you changed any `.ejs` files.
If you don't, CSS based changes won't take effect. This also makes sure that the final CSS bundle includes only what's
needed.

And use below to run `Ghosler` -

   ```shell
    npm run dev
   ```

### Custom Template

If you want to customize the newsletter template even more, follow the steps -

1. Create a **custom-template.ejs** in the root directory.
2. Customize it as you like, take a look at [pre-defined template](./views/newsletter.ejs) for reference.
3. That's it! Ghosler will use the new template for preview & sending newsletter.
4. Rename the file to anything if you don't want to use the custom template.

### TODOs

1. Add support for multiple newsletters.
2. <s>Add feedback support in newsletter template</s>.
3. <s>Build a `CLI` to install, update & other options to manage Ghosler instance</s>.

#### And don't forget to `⭐` the project!