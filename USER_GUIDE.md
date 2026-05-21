# User Guide

This app turns a YouTube link into an article-ready HTML package. You can generate and preview without extra setup. You only need keys or tokens if you want to publish to a logged-in CMS.

## What you need

- A YouTube link
- Optional: a Gemini API key (only if the app is not already configured)
- Optional: a Livewire cookie and CSRF token (only if you publish to a Livewire-based CMS)

## Get a Gemini API key

1. Open Google AI Studio: https://aistudio.google.com/app/apikey
2. Sign in or create a Google account.
3. Click Create API key (or Get API key).
4. Copy the key and keep it private.

If the page looks different, search for "Google AI Studio API key" and follow the prompts.

## Get the Livewire cookie and CSRF token

These values come from the browser when you are logged in to your CMS admin page.

1. Open Chrome or Edge.
2. Log in to your CMS admin page (the page where you create posts).
3. Press F12 (or Ctrl+Shift+I) to open Developer Tools.
4. Click the Network tab.> choose Fetch/XHR
5. Refresh the page.
6. In the request list, click a request that includes `/livewire/message/` in the name.
   - If you do not see it, type `livewire` in the Network filter box and try again.
7. In the right panel, open Headers and find Request Headers.
8. Copy these values:
   - `Cookie`: copy the entire value after `Cookie:`
   - `X-CSRF-TOKEN`: copy the entire value
   ![image-alt](https://github.com/148120Tran/ytb-link-to-artile/blob/55a74401f6d689197d1b9e27c019cc61ed10f0ec/F12%20cookie%20and%20csrf.png)
9. For the 'Publish endpoint override' it would be the domain name it would be inside where we create a post 
Network>apost api> header> Request URL > https://runwaytimes.cafex.biz/livewire/message/post-manager-component (this one for example)
10. For 'Livewire page URL override' it would be the domain name like 'https://runwaytimes.cafex.biz/backend/posts'

11. For 'Livewire snapshot override' 
![image-alt](https://github.com/148120Tran/ytb-link-to-artile/blob/55a74401f6d689197d1b9e27c019cc61ed10f0ec/livewire%20sample.png)





If you cannot find `X-CSRF-TOKEN`, use this fallback:

1. Go to the Elements tab.
2. Press Ctrl+F and search for `csrf-token`.
3. Copy the `content="..."` value from `<meta name="csrf-token" ...>`.

## Paste the values into the app

1. Paste the Gemini key into "Gemini API key (optional)".
2. Paste the Cookie value into "Livewire cookie (optional)".
3. Paste the token into "CSRF token (optional)".

You only need the cookie and token when you click Publish.

## Publish flow (short version)

1. Paste the YouTube link.
2. Click Generate.
3. Edit the article if needed.
4. Click Publish.

## Safety and expiration

- Treat the API key, cookie, and CSRF token like passwords.
- Do not share them.
- Cookies and CSRF tokens expire. If publish fails, repeat the steps to copy fresh values.
