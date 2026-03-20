import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const { email } = parsed.data;
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

    const user = await convex.query(api.queries.getUserByEmail, { email });

    // Always return success even if user not found (security)
    if (!user) {
      return NextResponse.json({
        message: 'If an account exists with this email, you will receive a password reset link.',
      });
    }

    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    await convex.mutation(api.userFunctions.setResetToken, {
      userId: user._id,
      resetToken,
      resetTokenExpiry,
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4010'}/reset-password?token=${resetToken}`;

    console.log('Password reset requested for:', email);
    console.log('Reset URL:', resetUrl);

    return NextResponse.json({
      message: 'If an account exists with this email, you will receive a password reset link.',
      ...(process.env.NODE_ENV === 'development' && { resetUrl }),
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 });
  }
}
