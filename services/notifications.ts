import { Twilio } from 'twilio';
import { Resend } from 'resend';
import { db } from '@/db';
import { smsEmailLogs } from '@/db/schema';

// Lazy initialization to avoid build-time errors when API keys are missing
let twilioClient: Twilio | null = null;
let resendClient: Resend | null = null;

function getTwilio() {
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

function getResend() {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

export async function sendSms(to: string, body: string) {
  const twilio = getTwilio();
  
  if (!twilio) {
    console.warn('SMS service not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in environment.');
    return null;
  }

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
  const resend = getResend();
  
  if (!resend) {
    console.warn('Email service not configured. Set RESEND_API_KEY in environment.');
    return null;
  }

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
