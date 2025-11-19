import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, gt } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { users } from '@/db/schema/users';

const schema = z.object({
  token: z.string(),
  password: z.string().min(3),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid token or password' },
        { status: 400 }
      );
    }
    
    const { token, password } = parsed.data;
    
    // Find user with valid reset token
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.resetToken, token),
          gt(users.resetTokenExpiry, new Date())
        )
      )
      .limit(1);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }
    
    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Update user password and clear reset token
    await db
      .update(users)
      .set({ 
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id));
    
    console.log('Password reset successful for:', user.email);
    
    return NextResponse.json({ 
      message: 'Password reset successful' 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
