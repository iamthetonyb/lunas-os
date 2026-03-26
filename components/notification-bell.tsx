'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useConvexUser } from '@/hooks/useConvexUser';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import type { Id } from '@/convex/_generated/dataModel';

type NotifFilter = 'all' | 'unread' | 'messages' | 'system';

export function NotificationBell() {
    const { t } = useTranslation();
    const router = useRouter();
    const { data: session } = useConvexUser();
    const userId = session?.user?.id as Id<'users'> | undefined;

    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState<NotifFilter>('all');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const count = useQuery(
        api.notifications.unreadCount,
        userId ? { userId } : 'skip'
    ) ?? 0;

    const notifications = useQuery(
        api.notifications.list,
        userId ? { userId, filter, limit: 30 } : 'skip'
    ) ?? [];

    const markRead = useMutation(api.notifications.markRead);
    const markAllRead = useMutation(api.notifications.markAllRead);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        if (open) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const badgeText = count > 100 ? '100+' : count > 0 ? String(count) : '';

    const handleNotifClick = async (notif: any) => {
        if (!notif.read) {
            await markRead({ id: notif._id });
        }
        // Navigate based on type
        if (notif.type === 'message' && notif.conversationId) {
            router.push(`/chat?c=${notif.conversationId}`);
        } else if (notif.relatedType === 'jobRequest' && notif.relatedId) {
            router.push(`/intake/${notif.relatedId}`);
        } else if (notif.relatedType === 'dispatch' && notif.relatedId) {
            router.push(`/dispatch/${notif.relatedId}`);
        } else if (notif.relatedType === 'workLog') {
            router.push('/work-log');
        }
        setOpen(false);
    };

    const formatTime = (ts: number) => {
        const diff = Date.now() - ts;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return t('common.justNow', 'Just now');
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h`;
        const days = Math.floor(hrs / 24);
        if (days < 7) return `${days}d`;
        return new Date(ts).toLocaleDateString();
    };

    const typeIcon = (type: string) => {
        switch (type) {
            case 'message': return (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
            );
            case 'job_request': return (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
            );
            case 'approval': return (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            );
            default: return (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
            );
        }
    };

    const filters: { key: NotifFilter; label: string }[] = [
        { key: 'all', label: t('chat.filterAll', 'All') },
        { key: 'unread', label: t('chat.filterUnread', 'Unread') },
        { key: 'messages', label: t('chat.filterMessages', 'Messages') },
        { key: 'system', label: t('chat.filterSystem', 'System') },
    ];

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell button */}
            <button
                onClick={() => setOpen(!open)}
                className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={t('chat.notifications', 'Notifications')}
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                {badgeText && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
                        {badgeText}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {open && (
                <div className="absolute right-0 sm:right-0 top-full mt-2 w-[calc(100vw-24px)] sm:w-96 max-h-[70vh] sm:max-h-[480px] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                            {t('chat.notifications', 'Notifications')}
                        </h3>
                        {count > 0 && userId && (
                            <button
                                onClick={() => markAllRead({ userId })}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                {t('chat.markAllRead', 'Mark all read')}
                            </button>
                        )}
                    </div>

                    {/* Filter tabs */}
                    <div className="px-3 pt-2 pb-1 flex gap-1 border-b border-gray-100 dark:border-slate-700">
                        {filters.map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                                    filter === f.key
                                        ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* Notification list */}
                    <div className="flex-1 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                                {t('chat.noNotifications', 'No notifications')}
                            </div>
                        ) : (
                            notifications.map((notif: any) => (
                                <button
                                    key={notif._id}
                                    onClick={() => handleNotifClick(notif)}
                                    className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors border-b border-gray-50 dark:border-slate-700/30 ${
                                        !notif.read ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''
                                    }`}
                                >
                                    <span className={`mt-0.5 flex-shrink-0 ${!notif.read ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                        {typeIcon(notif.type)}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-sm truncate ${!notif.read ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                            {notif.title}
                                        </p>
                                        {notif.body && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                                {notif.body}
                                            </p>
                                        )}
                                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                                            {formatTime(notif.createdAt)}
                                        </p>
                                    </div>
                                    {!notif.read && (
                                        <span className="mt-2 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    {/* Footer — link to chat page */}
                    <div className="px-4 py-2.5 border-t border-gray-100 dark:border-slate-700">
                        <button
                            onClick={() => { router.push('/chat'); setOpen(false); }}
                            className="w-full text-center text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            {t('chat.viewAllMessages', 'View All Messages & Chat')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
