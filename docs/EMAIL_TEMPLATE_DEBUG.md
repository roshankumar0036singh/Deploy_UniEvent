# Feedback Email Template Debugging Guide

## Current Configuration

The feedback email system uses **EmailJS** (not a backend service).

### EmailJS Settings (from `EmailService.js`)
- **Service ID**: `service_l8ymwou`
- **Public Key**: `JEl6-aRIRV9Pbp_ZC`
- **Feedback Template ID**: `template_feedback`
- **Announcement Template ID**: `template_default`

## Common Issues & Solutions

### 1. **Template Doesn't Exist**
**Problem**: The template `template_feedback` might not exist in your EmailJS account.

**Solution**:
1. Go to [EmailJS Dashboard](https://dashboard.emailjs.com/)
2. Login with your account
3. Navigate to **Email Templates**
4. Check if `template_feedback` exists
5. If not, create it with these variables:
   - `{{to_name}}` - Recipient name
   - `{{to_email}}` - Recipient email
   - `{{subject}}` - Email subject
   - `{{message}}` - Email body
   - `{{event_title}}` - Event name
   - `{{feedback_link}}` - Link to feedback form

### 2. **Template Variables Mismatch**
**Problem**: Template variables in EmailJS don't match what the code is sending.

**Check**: The code sends these variables (line 93):
```javascript
{
  to_name: participantName,
  to_email: participantEmail,
  subject: "Feedback Request: EventTitle",
  message: "Thank you for attending...",
  event_title: eventTitle,
  feedback_link: "https://unievent-ez2w.onrender.com/event/eventId/feedback"
}
```

**Solution**: Make sure your EmailJS template uses these exact variable names with `{{variable_name}}` syntax.

### 3. **Service Not Connected**
**Problem**: Email service `service_l8ymwou` might not be properly configured.

**Solution**:
1. Go to EmailJS Dashboard → **Email Services**
2. Verify the service ID matches `service_l8ymwou`
3. Check if the service is connected (Gmail, Outlook, etc.)
4. Test the service connection

### 4. **Public Key Invalid**
**Problem**: The public key `JEl6-aRIRV9Pbp_ZC` might be incorrect or expired.

**Solution**:
1. Go to EmailJS Dashboard → **Account** → **General**
2. Copy the correct **Public Key**
3. Update line 6 in `EmailService.js`

### 5. **Rate Limiting**
**Problem**: EmailJS free tier has limits (200 emails/month).

**Solution**:
- Check your EmailJS dashboard for usage
- Upgrade plan if needed
- For testing, send to fewer recipients

### 6. **CORS Issues (Web Only)**
**Problem**: Browser might block EmailJS API calls.

**Solution**: EmailJS API should work, but check browser console for CORS errors.

## Testing Steps

1. **Test Single Email**:
   ```javascript
   // In browser console or test file
   import { sendEmail } from './src/lib/EmailService';
   
   sendEmail(
     'Test User',
     'your-email@example.com',
     'Test Subject',
     'Test Message',
     { event_title: 'Test Event', feedback_link: 'https://example.com' },
     'template_feedback'
   );
   ```

2. **Check Browser Console**: Look for errors when sending

3. **Check EmailJS Dashboard**: 
   - Go to **History** tab
   - See if emails are being sent
   - Check for error messages

## Sample EmailJS Template

Create a template named `template_feedback` with this content:

**Subject**: `{{subject}}`

**Body**:
```
Hi {{to_name}},

{{message}}

Event: {{event_title}}

Please share your feedback here:
{{feedback_link}}

Thank you!
UniEvent Team
```

## Quick Fix Checklist

- [ ] Login to EmailJS Dashboard
- [ ] Verify service `service_l8ymwou` exists and is connected
- [ ] Verify template `template_feedback` exists
- [ ] Check template variables match code
- [ ] Test with a single email first
- [ ] Check EmailJS usage/quota
- [ ] Review EmailJS History for errors
