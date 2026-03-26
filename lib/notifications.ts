/**
 * Notification helpers — email via Resend, SMS via Twilio.
 * Called directly from AI tools (API route, Node.js runtime).
 */
import { Resend } from "resend";
import twilio from "twilio";

const FROM_EMAIL =
    process.env.RESEND_FROM_EMAIL ||
    "LUNAS AI <notifications@lunas.construction>";

/**
 * Send email via Resend SDK.
 * Supports FreeResend (self-hosted) — set RESEND_BASE_URL env var
 * to point to your FreeResend instance (e.g. https://mail.yourdomain.com/api).
 * The Resend SDK reads this env var automatically. No code changes needed.
 */
export async function sendEmail(to: string, subject: string, html: string) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey)
        return {
            error: "RESEND_API_KEY not configured. Ask admin to set it in Vercel env vars.",
        };

    const resend = new Resend(apiKey);
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject: `[LUNAS] ${subject}`,
            html,
        });
        if (error) return { error: error.message };
        return { success: true, emailId: data?.id };
    } catch (e: any) {
        return { error: e.message };
    }
}

/** Send a chat notification email to a recipient. */
export async function sendChatNotificationEmail(
    to: string,
    senderName: string,
    messagePreview: string,
    conversationName?: string
) {
    const subject = conversationName
        ? `New message from ${senderName} in "${conversationName}"`
        : `New message from ${senderName}`;

    const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
            <div style="background: #2563eb; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
                <h2 style="margin: 0; font-size: 18px;">${subject}</h2>
            </div>
            <div style="padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="color: #374151; font-size: 15px; line-height: 1.5; margin: 0 0 16px;">
                    <strong>${senderName}:</strong> ${messagePreview}
                </p>
                <p style="color: #6b7280; font-size: 13px; margin: 0;">
                    Log in to LUNAS OS to reply.
                </p>
            </div>
        </div>
    `;

    return sendEmail(to, subject, html);
}

export async function sendSms(to: string, body: string) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
        return {
            error: "Twilio credentials not configured. Ask admin to set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in Vercel env vars.",
        };
    }

    try {
        const client = twilio(accountSid, authToken);
        const message = await client.messages.create({
            body: `[LUNAS] ${body}`,
            from: fromNumber,
            to,
        });
        return { success: true, messageSid: message.sid };
    } catch (e: any) {
        return { error: e.message };
    }
}
