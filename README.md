# Bridge To AI — Client Intake App
## Deployment Guide for Darren

This is the `intake.bridgetoai.ca` client interview application.
Clients answer 11 voice/text questions. Their answers are compiled by Claude into a Business DNA file and emailed directly to you. The client never sees the output or the process.

---

## What's in this folder

```
bridge-intake/
├── index.html          ← The entire client-facing interview app
├── api/
│   └── send-email.js   ← Serverless function that emails you the DNA file
├── vercel.json         ← Vercel routing configuration
└── README.md           ← This file
```

---

## Step 1 — Get your API keys (two required)

### A) Anthropic API Key
1. Go to https://console.anthropic.com
2. Click **API Keys** → **Create Key**
3. Copy the key (starts with `sk-ant-...`)
4. Keep it safe — you'll add it to Vercel in Step 3

### B) Resend API Key (free email service — 3,000 emails/month free)
1. Go to https://resend.com and create a free account
2. Add your domain `bridgetoai.ca` under **Domains**
3. Follow their DNS verification steps (adds 2 records in GoDaddy)
4. Click **API Keys** → **Create API Key**
5. Copy the key (starts with `re_...`)

---

## Step 2 — Deploy to Vercel

### Option A — Vercel Dashboard (easiest)
1. Go to https://vercel.com and log in
2. Click **Add New → Project**
3. Choose **Import Third-Party Git Repository** or drag and drop this folder
4. If using GitHub: push this folder to a new GitHub repo first, then import it
5. Click **Deploy**

### Option B — Vercel CLI
```bash
npm install -g vercel
cd bridge-intake
vercel
```
Follow the prompts. Choose your existing account. Deploy to production when asked.

---

## Step 3 — Add environment variables in Vercel

After deploying, go to your project in Vercel:
1. Click **Settings** → **Environment Variables**
2. Add these two variables:

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic key from Step 1A |
| `RESEND_API_KEY` | Your Resend key from Step 1B |

3. Click **Save** and then **Redeploy** the project

---

## Step 4 — Add the subdomain in GoDaddy

1. Log in to GoDaddy → **My Products** → **DNS** for `bridgetoai.ca`
2. Click **Add New Record**
3. Set:
   - **Type:** CNAME
   - **Name:** intake
   - **Value:** `cname.vercel-dns.com` *(get your exact value from Vercel: Settings → Domains)*
   - **TTL:** 1 hour
4. Save

---

## Step 5 — Add the subdomain in Vercel

1. In your Vercel project → **Settings** → **Domains**
2. Type `intake.bridgetoai.ca` and click **Add**
3. Vercel will confirm when DNS has propagated (usually 5–30 minutes)

---

## Step 6 — Test it

1. Visit `https://intake.bridgetoai.ca`
2. Enter a test name and business category
3. Answer a few questions (can be dummy answers)
4. Submit
5. Check `darren@bridgetoai.ca` for the DNA email with attachment

---

## How to use it with clients

1. Open `https://intake.bridgetoai.ca` on a laptop or tablet
2. Turn the screen toward the client
3. Tell them: *"Just answer these questions out loud or type — I'll step out while you do it."*
4. Leave the room
5. You'll get a text notification (if configured) or check your email
6. Come back, review the DNA file, load it into their Claude project

---

## Updating the questions

All 11 interview questions are in `index.html` inside the `QUESTIONS` array (around line 220).
Each question has:
- `domain` — the section label shown to the client
- `text` — the actual question
- `hint` — the grey helper text below the question

Edit and redeploy whenever you want to refine the interview.

---

## Updating the DNA prompt

The instructions Claude uses to compile the DNA file are in `index.html` inside the `buildPrompt()` function (around line 320). You can adjust what sections get generated, how they're formatted, or what the consultant notes focus on.

---

## Troubleshooting

**Email not arriving?**
- Check Vercel logs: Project → **Functions** → `send-email`
- Verify both environment variables are set and the project was redeployed after adding them
- Check your Resend dashboard for delivery status

**Voice input not working?**
- Voice requires Chrome or Edge — Safari has limited support
- The site must be served over HTTPS (Vercel does this automatically)
- Client may need to allow microphone permission in their browser

**DNS not resolving?**
- DNS changes take 5 minutes to 48 hours to propagate
- Use https://dnschecker.org to check if `intake.bridgetoai.ca` is resolving

---

*Bridge To AI — Kandar Consulting · Built June 2026*
