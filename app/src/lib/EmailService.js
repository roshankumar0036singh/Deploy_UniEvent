import { Alert } from 'react-native';

// EmailJS Configuration
// EmailJS Configuration
const EMAILJS_SERVICE_ID = 'service_l8ymwou';
const EMAILJS_PUBLIC_KEY = 'JEl6-aRIRV9Pbp_ZC';
const EMAILJS_TEMPLATE_ANNOUNCEMENT = 'template_default';
const EMAILJS_TEMPLATE_FEEDBACK = 'template_feedback';

/**
 * Sends an email using EmailJS
 * @param {string} toName - Recipient Name
 * @param {string} toEmail - Recipient Email
 * @param {string} subject - Email Subject
 * @param {string} message - Email Body
 * @param {object} additionalData - Extra variables for the template
 * @param {string} templateId - Template ID to use
 */
export const sendEmail = async (toName, toEmail, subject, message, additionalData = {}, templateId = EMAILJS_TEMPLATE_ANNOUNCEMENT) => {
    const data = {
        service_id: EMAILJS_SERVICE_ID,
        template_id: templateId,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: {
            to_name: toName,
            to_email: toEmail,
            subject: subject,
            message: message,
            ...additionalData
        }
    };

    try {
        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (response.ok) {
            console.log('Email sent successfully to:', toEmail);
            return true;
        } else {
            const errorText = await response.text();
            console.error('EmailJS Error:', errorText);
            // Alert.alert("Email Error", "Failed to send email. Check configuration."); // Suppress alert for bulk
            return false;
        }
    } catch (error) {
        console.error('Network Error:', error);
        return false;
    }
};

/**
 * Sends a bulk announcement to a list of participants
 * @param {Array} participants - List of { name, email } objects
 * @param {string} subject 
 * @param {string} message 
 */
export const sendBulkAnnouncement = async (participants, subject, message) => {
    let successCount = 0;
    for (const p of participants) {
        if (p.email) {
            const sent = await sendEmail(p.name || 'Participant', p.email, subject, message, {}, EMAILJS_TEMPLATE_ANNOUNCEMENT);
            if (sent) successCount++;
        }
    }
    return successCount;
};

/**
 * Sends a bulk feedback request to participants
 * @param {Array} participants 
 * @param {string} eventTitle 
 * @param {string} eventId 
 */
export const sendBulkFeedbackRequest = async (participants, eventTitle, eventId) => {
    let successCount = 0;
    const feedbackLink = `https://unievent-ez2w.onrender.com/event/${eventId}/feedback`; // Update with your actual link
    const subject = `Feedback Request: ${eventTitle}`;
    const message = `Thank you for attending ${eventTitle}. Please take a moment to share your feedback.`;

    for (const p of participants) {
        if (p.email) {
            const sent = await sendEmail(
                p.name || 'Participant',
                p.email,
                subject,
                message,
                { event_title: eventTitle, feedback_link: feedbackLink },
                EMAILJS_TEMPLATE_FEEDBACK
            );
            if (sent) successCount++;
        }
    }
    return successCount;
};
