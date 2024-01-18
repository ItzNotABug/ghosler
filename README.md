## Ghosler - Ghost Newsletters 👻

**Ghosler** enables easy sending of newsletters using your own email and SMTP credentials.\
This is ideal when you are just starting out and have a small to moderate user base.

It is helpful for bypassing the limitations of the hardcoded Mailgun setup and supports many analytical features, along
with the capability to use **multiple** email accounts.

---
**Note**: `Ghosler` supports only **one** newsletter at this time. **Please avoid using it if you manage multiple
active newsletters**.

---

### Screenshots

- **Newsletter**
    <table>
      <tr>
        <td><img style="border-radius: 2px;" src="https://github.com/ItzNotABug/ghosler/assets/20625965/8f909219-7d20-444c-af49-3a4d9b309e5b" alt="Ghosler - Newsletter Preview" /></td>
        <td><img style="border-radius: 2px;" src="https://github.com/ItzNotABug/ghosler/assets/20625965/9264b063-b064-4096-8c52-b10c4b0f4656" alt="Ghosler - Newsletter Preview" /></td>
        <td><img style="border-radius: 2px;" src="https://github.com/ItzNotABug/ghosler/assets/20625965/75798fa3-7246-44f0-867e-0e716a24a1f4" alt="Ghosler - Newsletter Preview" /></td>
        <td><img style="border-radius: 2px;" src="https://github.com/ItzNotABug/ghosler/assets/20625965/e5fdc7c9-f762-46f1-bee2-65a564909919" alt="Ghosler - Newsletter Preview" /></td>
      </tr>
    </table>

- **Dashboard**

    <details>
    <summary>
    Mobile View
    </summary>
    <table>
      <tr>
        <td><img style="border-radius: 2px;" src="https://github.com/ItzNotABug/ghosler/assets/20625965/225d6929-68f1-474d-a694-257197c41424" alt="Ghosler - Login" /></td>
        <td><img style="border-radius: 2px;" src="https://github.com/ItzNotABug/ghosler/assets/20625965/39571ef5-d1f0-4145-b205-37963e28fda7" alt="Ghosler - Home" /></td>
        <td><img style="border-radius: 2px;" src="https://github.com/ItzNotABug/ghosler/assets/20625965/dc72d8c0-7943-44ce-8ffa-56fbac51c703" alt="Ghosler - Analytics" /></td>
      </tr>
      <tr>
        <td><img style="border-radius: 2px;" src="https://github.com/ItzNotABug/ghosler/assets/20625965/e06ac7aa-9e6b-4bd4-8227-d8ea76f58f64" alt="Ghosler - Analytics - Details" /></td>
        <td><img style="border-radius: 2px;" src="https://github.com/ItzNotABug/ghosler/assets/20625965/3c75cb17-dc0a-4662-aef3-b696d70cca65" alt="Ghosler - Settings" /></td>
        <td><img style="border-radius: 2px;" src="https://github.com/ItzNotABug/ghosler/assets/20625965/55e45089-fac1-40ef-b818-a440465d7c9d" alt="Ghosler - Logs" /></td>
      </tr>
    </table>
    </details>

    <details>
    <summary>
    Desktop View
    </summary>
    <table>
      <tr>
        <td><img src="https://github.com/ItzNotABug/ghosler/assets/20625965/39e5a0b1-2053-4a5f-8efa-96c45f3e3369" alt="Ghosler - Login" /></td>
        <td><img src="https://github.com/ItzNotABug/ghosler/assets/20625965/3f18b7a5-8fcd-4bed-821f-963237052d4f" alt="Ghosler - Home" /></td>
        <td><img src="https://github.com/ItzNotABug/ghosler/assets/20625965/60e9c9ad-6ae6-46c3-8708-0b9d91a960d9" alt="Ghosler - Analytics" /></td>
      </tr>
      <tr>
        <td><img src="https://github.com/ItzNotABug/ghosler/assets/20625965/eadacf4f-e9dd-45e3-b8f1-4aa18be4a41c" alt="Ghosler - Analytics - Details" /></td>
        <td><img src="https://github.com/ItzNotABug/ghosler/assets/20625965/0061ac2b-7aa5-48ca-8de4-9383c7a5d81e" alt="Ghosler - Settings" /></td>
        <td><img src="https://github.com/ItzNotABug/ghosler/assets/20625965/a6fa0f5e-8fd4-4fc4-ac01-e27b756ba749" alt="Ghosler - Logs" /></td>
      </tr>
    </table>
    </details>

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
- **Ghost Native Widgets**: Ghosler supports major Ghost widgets (cards) for your newsletter, out of the box.\
  See: [#17](https://github.com/ItzNotABug/ghosler/pull/17) for more info.
- **Custom Email Subjects**: Ghosler allows using customised email subject for your newsletter.\
  See: [#28](https://github.com/ItzNotABug/ghosler/pull/28) for more info.

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
4. **Only publishing a Post**: If you want to only publish a post & not send it via email, just add the `#GhoslerIgnore`
   tag to a post. The internal tag is created for you on the initial setup.

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