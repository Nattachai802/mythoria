/**
 * Email sending utility using Resend
 * Make sure to set RESEND_API_KEY in your .env file
 */

import { Resend } from 'resend';

interface SendEmailOptions {
    to: string;
    subject: string;
    text: string;
    html?: string;
}

export const resend = new Resend(process.env.RESEND_API_KEY || '');

export async function sendEmail(options: SendEmailOptions): Promise<void> {
    const { to, subject, text, html } = options;

    try {
        // Send email using Resend
        await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
            to,
            subject,
            text,
            html: html || text, // Use HTML if provided, otherwise fall back to text
        });

        console.log('✅ Email sent successfully to:', to);
    } catch (error) {
        console.error('❌ Failed to send email:', error);
        throw error;
    }
}
