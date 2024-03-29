## Ghosler - Ghost Newsletters 👻

**Ghosler** enables easy sending of newsletters using your own email and SMTP credentials.\
This is ideal when you are just starting out and have a small to moderate user base.

It is helpful for bypassing the limitations of the hardcoded Mailgun setup and supports many analytical features, along
with the capability to use **multiple** email accounts.

---

### Table of Contents

- [Screenshots](#screenshots)
- [Key Features](#key-features)
- [Running Ghosler](#running-ghosler)
- [Setup Instructions](#setup-instructions)
- [Testing Configurations](#testing-configurations)
- [Using Custom Templates](#custom-template)

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
- **Ghost Native Widgets**: Ghosler supports major Ghost widgets (cards) for your newsletter, out of the box.
- **Custom Email Subjects**: Ghosler allows using customised email subject for your newsletter.
- **Multiple Newsletters**: Ghosler supports managing multiple newsletters! Publish a post & select the newsletter to
  associate with & instantly send emails.
- **Docker Support**: Ghosler also supports a straight forward Docker container.

### Running Ghosler

#### 1. Installation with `NPM`

Pre-requisites: `Node 18^` & `pm2` installed.

1. Install the `CLI` -

  ```npm
  npm install -g ghosler-cli
  ```

2. Go to the directory you want to install `Ghosler`, make sure its empty & run below command -

  ```shell
  ghosler install
  ```

#### 2. Installation with `Docker`

Execute this script to install or update `Ghosler` via `Docker` -

```bash
curl -sSL https://raw.githubusercontent.com/ItzNotABug/ghosler/master/docker-install.sh -o docker-install.sh && chmod +x docker-install.sh && ./docker-install.sh
```

If you already have `docker-install.sh` on your system, simply execute -

```bash
./docker-install.sh
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
    - Fire up the Ghosler front-end by going to `https://your-domain.com`.
        - Default `PORT` is `2369`
        - Default login credentials are - Username: `ghosler`, Password - `admin`
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

Ghosler defaults to using a local configuration file, `config.local.json`, if it exists. The structure of this file is
identical to that in [config.production.json](./configuration/config.production.json) file.

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

You can use below for combining the above commands -

   ```shell
    npm run cleanstart
   ```

##### Building the Docker Image -

```bash
docker build -t ghosler . --no-cache
```

After a successful local build, run the container -

```bash
docker run --rm name ghosler -d -p 2369:2369 -v ghosler-logs:/usr/src/app/.logs -v ghosler-analytics:/usr/src/app/files -v ghosler-configuration:/usr/src/app/configuration ghosler
```

**Note**: For testing the Docker container over a publicly accessible URL, I used `Cloudflare Tunnel` as it doesn't have
a startup page like `ngrok` or the `VSCode`'s dev tunnel and works good for testing the Ghost Webhooks.

Assuming you have `TryCloudflare CLI` installed, you can do something like this -

```bash
cloudflared tunnel --url http://localhost:2369
```

This command will initialize a tunnel and return a URL that you can use to test.\
For more info, see - [TryCloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/).

### Custom Template

If you want to customize the newsletter template even more, follow the steps -

1. Create a **custom-template.ejs** in the root directory.
2. Customize it as you like, take a look at [pre-defined template](./views/newsletter.ejs) for reference.
3. That's it! Ghosler will use the new template for preview & sending newsletter.
4. Rename the file to anything if you don't want to use the custom template.

---

#### And don't forget to `⭐` the project!