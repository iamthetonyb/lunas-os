import { NextRequest, NextResponse } from 'next/server';

const CLERK_API = 'https://api.clerk.com/v1';

async function clerkFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${CLERK_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.errors?.[0]?.long_message || data.errors?.[0]?.message || 'Clerk API error');
  return data;
}

// POST /api/users — Create a new user in Clerk + Convex
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, firstName, lastName } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Create in Clerk
    const clerkUser = await clerkFetch('/users', {
      method: 'POST',
      body: JSON.stringify({
        email_address: [email],
        password,
        first_name: firstName || email.split('@')[0],
        last_name: lastName || '',
        skip_password_checks: true,
      }),
    });

    return NextResponse.json({
      success: true,
      clerkUserId: clerkUser.id,
      email: clerkUser.email_addresses[0]?.email_address,
    });
  } catch (err: any) {
    console.error('Failed to create user:', err);
    return NextResponse.json({ error: err.message || 'Failed to create user' }, { status: 500 });
  }
}

// PATCH /api/users — Update password in Clerk
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Find Clerk user by email
    const users = await clerkFetch(`/users?email_address=${encodeURIComponent(email)}`);
    if (!users.length) {
      return NextResponse.json({ error: 'User not found in Clerk' }, { status: 404 });
    }

    // Update password
    await clerkFetch(`/users/${users[0].id}`, {
      method: 'PATCH',
      body: JSON.stringify({ password, skip_password_checks: true }),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Failed to update user:', err);
    return NextResponse.json({ error: err.message || 'Failed to update user' }, { status: 500 });
  }
}

// DELETE /api/users — Delete user from Clerk
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Find and delete Clerk user
    const users = await clerkFetch(`/users?email_address=${encodeURIComponent(email)}`);
    if (users.length) {
      await clerkFetch(`/users/${users[0].id}`, { method: 'DELETE' });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Failed to delete user:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete user' }, { status: 500 });
  }
}
