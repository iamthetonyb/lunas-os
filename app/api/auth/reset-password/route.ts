import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

const schema = z.object({
  token: z.string(),
  password: z.string().min(3),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid token or password' }, { status: 400 });
    }

    const { token, password } = parsed.data;
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

    const user = await convex.query(api.userFunctions.getUserByResetToken, { token });

    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < Date.now()) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await convex.mutation(api.userFunctions.updatePassword, {
      userId: user.id as Id<"users">,
      passwordHash,
    });

    console.log('Password reset successful for:', user.email);

    return NextResponse.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 });
  }
}
