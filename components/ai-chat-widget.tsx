'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

// Lazy-load the heavy chat panel — zero AI SDK bundle until user clicks
const AIChatPanel = dynamic(() => import('./ai-chat-panel'), {
    loading: () => (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[560px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex items-center justify-center border border-gray-200 dark:border-slate-700">
            <div className="flex gap-1">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
        </div>
    ),
    ssr: false,
});

export function AIChatWidget() {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();

    // Hide on chat page — the floating button conflicts with the message input
    if (pathname === '/chat') return null;

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                aria-label="Open LUNAS AI"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
            </button>
        );
    }

    return <AIChatPanel onClose={() => setOpen(false)} />;
}
