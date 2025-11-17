'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');

  useEffect(() => {
    if (!token) {
      setMessage('Invalid or missing reset token.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }
    
    if (password.length < 3) {
      setMessage('Password must be at least 3 characters long.');
      return;
    }
    
    setIsLoading(true);
    setMessage('');
    
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setMessage('Password reset successful! Redirecting to login...');
        setTimeout(() => router.push('/login'), 2000);
      } else {
        setMessage(data.error || 'Failed to reset password. Please try again.');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      setMessage('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Reset Link</h1>
              <p className="text-gray-600 mb-6">This password reset link is invalid or has expired.</p>
              <button
                onClick={() => router.push('/forgot-password')}
                className="text-blue-600 hover:text-blue-700 hover:underline"
              >
                Request a new reset link
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Set New Password</h1>
            <p className="text-gray-600 mt-2">Enter your new password below</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                New Password
              </label>
              <input 
                id="password" 
                name="password" 
                type="password" 
                placeholder="Enter new password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                autoComplete="new-password"
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            
            <div>
              <label 
                htmlFor="confirmPassword" 
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirm New Password
              </label>
              <input 
                id="confirmPassword" 
                name="confirmPassword" 
                type="password" 
                placeholder="Confirm new password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                autoComplete="new-password"
                required 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            
            {message && (
              <div className={`p-3 rounded-lg text-sm ${message.includes('error') || message.includes('Failed') || message.includes('Invalid') || message.includes('do not match') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {message}
              </div>
            )}
            
            <button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="text-center">Loading...</div>
      </main>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
