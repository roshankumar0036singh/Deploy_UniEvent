# How to Set Up Feedback Email Template in EmailJS

## Step-by-Step Guide

### 1. **Login to EmailJS**
Go to [EmailJS Dashboard](https://dashboard.emailjs.com/) and login.

### 2. **Create New Template**
1. Click on **Email Templates** in the sidebar
2. Click **Create New Template**
3. Name it: `template_feedback`

### 3. **Set Up Template**
1. **Subject Line**: 
   ```
   Feedback Request: {{event_title}}
   ```

2. **Content Type**: Select **HTML** (not plain text)

3. **HTML Body**: Copy and paste the entire content from `feedback_email_template.html`

### 4. **Template Variables**
The template uses these variables (automatically filled by the app):
- `{{to_name}}` - Participant's name
- `{{event_title}}` - Event name
- `{{feedback_link}}` - Link to feedback form

### 5. **Test the Template**
1. Click **Test It** button in EmailJS
2. Fill in sample values:
   - `to_name`: Your Name
   - `event_title`: Sample Event
   - `feedback_link`: https://unievent-ez2w.onrender.com/event/test123
3. Send test email to yourself

### 6. **Save Template**
Click **Save** and note the Template ID (should be `template_feedback`)

### 7. **Verify in Code**
The app is already configured to use this template (line 8 in `EmailService.js`):
```javascript
const EMAILJS_TEMPLATE_FEEDBACK = 'template_feedback';
```

## Template Preview

The email will look like:
- ⭐ Orange gradient star icon at top
- "How was your experience?" heading
- Personalized greeting with participant name
- Event title in orange
- Beautiful gradient "Rate Event" button
- Footer with copyright

## Troubleshooting

**If emails still don't send:**
1. Check EmailJS Dashboard → History for errors
2. Verify Service ID: `service_l8ymwou` is connected
3. Check monthly quota (200 emails on free tier)
4. Test with browser console open to see errors

**Common Issues:**
- Template ID mismatch (must be exactly `template_feedback`)
- Service not connected to email provider
- Rate limit exceeded
- Invalid public key

## Testing from App

1. Go to any event's Attendance Dashboard
2. Click "Request Feedback" button
3. Check browser console for success/error messages
4. Check your email inbox
5. Verify EmailJS Dashboard → History shows the send

---

**Template File**: `docs/feedback_email_template.html`
**EmailJS Dashboard**: https://dashboard.emailjs.com/
