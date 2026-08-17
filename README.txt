Bridge To AI - Cloudflare Turnstile Site Key Package

FILES
-----
1. turnstile-config.js

WHERE TO PUT IT
---------------
Place turnstile-config.js in the SAME folder as index.html.

Then, in index.html, add this line BEFORE your main script block:

<script src="/turnstile-config.js"></script>

In your existing CONFIG object, change:

TURNSTILE_SITE_KEY: ''

to:

TURNSTILE_SITE_KEY: window.BTAI_CONFIG?.TURNSTILE_SITE_KEY || ''

IMPORTANT
---------
The Turnstile SITE key is public and belongs in browser-side code.

DO NOT put TURNSTILE_SECRET_KEY in this package, index.html, GitHub, or browser JavaScript.
Keep TURNSTILE_SECRET_KEY only in Vercel Environment Variables.

After updating the files, redeploy the Vercel project.
