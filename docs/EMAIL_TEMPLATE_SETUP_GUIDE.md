# 📧 Simplified Email Setup Guide (Universal Template)

We have simplified the email system! You now only need **ONE** main template for both Announcements and Certificates.

## 1. Login to EmailJS
Go to [EmailJS Dashboard](https://dashboard.emailjs.com/).

## 2. Create the Universal Template
1. Go to **Email Templates** > **Create New Template**.
2. **Name**: `Universal Template` (or `General Template`)
3. **Template ID**: Change it to `template_general`
   *(If you can't change it, copy the ID generated and update `app/src/lib/EmailService.js` line 6 to match)*.
4. **Subject**: `{{subject}}`
5. **Content**: Click "Source Code" (< > icon) and paste the content from `docs/universal_email_template.html`.
6. **Save**.

## 3. How it Works
- **Announcements**: Uses this template. The certificate section is hidden automatically.
- **Certificates**: Uses **the same template**. The certificate section appears automatically below the message.

## 4. Feedback Template (Optional)
If you still want Feedback requests, keep your `template_feedback` or create it using `docs/feedback_email_template.html`.

## Check Service ID
Ensure `EMAILJS_SERVICE_ID` in `app/src/lib/EmailService.js` matches your EmailJS Service ID.

✅ **All Set!** You can now send Announcements AND Certificates using just this one template!
