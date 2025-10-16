import { Twilio } from 'twilio';
import { Resend } from 'resend';
import { db } from '@/db';
import { smsEmailLogs } from '@/db/schema';

const twilio = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendSms(to: string, body: string) {
  try {
    const message = await twilio.messages.create({
      body,
      from: process.env.TWILIO_FROM,
      to,
    });

    await db.insert(smsEmailLogs).values({
      kind: 'sms',
      to,
      body,
      meta: { messageSid: message.sid },
    });

    return message;
  } catch (error) {
    console.error('Failed to send SMS:', error);
    throw error;
  }
}

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Lunas OS <noreply@lunas-os.com>', // This should be a configured domain in Resend
      to,
      subject,
      html,
    });

    if (error) {
      throw error;
    }

    await db.insert(smsEmailLogs).values({
      kind: 'email',
      to,
      body: html,
      meta: { messageId: data?.id },
    });

    return data;
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}
