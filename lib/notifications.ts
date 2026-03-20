/**
 * Notification helpers — email via Resend, SMS via Twilio.
 * Called directly from AI tools (API route, Node.js runtime).
 */
import { Resend } from "resend";
import twilio from "twilio";

const FROM_EMAIL =
    process.env.RESEND_FROM_EMAIL ||
    "LUNAS AI <notifications@lunas.construction>";

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
