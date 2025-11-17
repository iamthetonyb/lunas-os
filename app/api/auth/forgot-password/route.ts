import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { getDb } from '@/lib/db/get-db';
import { users } from '@/db/schema/users';

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }
    
    const { email } = parsed.data;
    const db = getDb();
    
    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    // For security, always return success even if user not found
    if (!user) {
      return NextResponse.json({ 
        message: 'If an account exists with this email, you will receive a password reset link.' 
      });
    }
    
    // Generate reset token (valid for 1 hour)
    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
    
    // Update user with reset token
    await db
      .update(users)
      .set({ 
        resetToken, 
        resetTokenExpiry,
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id));
    
    // Generate reset URL
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4010'}/reset-password?token=${resetToken}`;
    
    // In production, send email here using your email service
    // For now, log to console for development
    console.log('Password reset requested for:', email);
    console.log('Reset URL:', resetUrl);
    console.log('Token expires:', resetTokenExpiry);
    
    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    // Example:
    // await sendEmail({
    //   to: email,
    //   subject: 'Password Reset Request',
    //   html: `Click here to reset your password: <a href="${resetUrl}">${resetUrl}</a>`
    // });
    
    return NextResponse.json({ 
      message: 'If an account exists with this email, you will receive a password reset link.',
      // Include URL in dev mode for testing
      ...(process.env.NODE_ENV === 'development' && { resetUrl })
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
