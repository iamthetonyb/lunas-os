'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useConvexUser } from '@/hooks/useConvexUser';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { Id } from '@/convex/_generated/dataModel';
import { PageHeader } from '@/components/page-header';

// ── Types ───────────────────────────────────────────────────────────

type ConvView = 'chats' | 'notifications' | 'all';

// ── Main Page ───────────────────────────────────────────────────────

export default function ChatPage() {
    const { t } = useTranslation();
    const { data: session } = useConvexUser();
    const userId = session?.user?.id as Id<'users'> | undefined;
    const searchParams = useSearchParams();
    const selectedConvParam = searchParams.get('c');

    const [selectedConvId, setSelectedConvId] = useState<string | null>(selectedConvParam);
    const [view, setView] = useState<ConvView>('chats');
    const [showNewChat, setShowNewChat] = useState(false);
    const [showNewGroup, setShowNewGroup] = useState(false);

    // Sync URL param
    useEffect(() => {
        if (selectedConvParam) setSelectedConvId(selectedConvParam);
    }, [selectedConvParam]);

    if (!userId) {
        return (
            <div className="flex items-center justify-center h-96">
                <p className="text-gray-400 dark:text-gray-500">{t('common.loading', 'Loading...')}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-0px)]">
            <PageHeader title={t('chat.title', 'Messages')} description={t('chat.description', 'Team chat & notifications')} />
            <div className="flex flex-1 min-h-0 border-t border-gray-200 dark:border-slate-700">
                {/* Left panel — conversation list */}
                <ConversationList
                    userId={userId}
                    selectedConvId={selectedConvId}
                    onSelect={setSelectedConvId}
                    view={view}
                    onViewChange={setView}
                    showNewChat={showNewChat}
                    setShowNewChat={setShowNewChat}
                    showNewGroup={showNewGroup}
                    setShowNewGroup={setShowNewGroup}
                />
                {/* Right panel — messages or notification detail */}
                <div className="flex-1 flex flex-col min-w-0">
                    {selectedConvId ? (
                        <MessagePanel conversationId={selectedConvId as Id<'conversations'>} userId={userId} />
                    ) : (
                        <EmptyState view={view} />
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Conversation List ───────────────────────────────────────────────

function ConversationList({
    userId, selectedConvId, onSelect, view, onViewChange,
    showNewChat, setShowNewChat, showNewGroup, setShowNewGroup,
}: {
    userId: Id<'users'>;
    selectedConvId: string | null;
    onSelect: (id: string | null) => void;
    view: ConvView;
    onViewChange: (v: ConvView) => void;
    showNewChat: boolean;
    setShowNewChat: (v: boolean) => void;
    showNewGroup: boolean;
    setShowNewGroup: (v: boolean) => void;
}) {
    const { t } = useTranslation();
    const conversations = useQuery(api.chat.listConversations, { userId }) ?? [];
    const notifications = useQuery(
        api.notifications.list,
        view === 'notifications' || view === 'all' ? { userId, filter: 'system', limit: 50 } : 'skip'
    ) ?? [];

    const allUsers = useQuery(api.queries.getUsers, { limit: 200 }) ?? [];
    const otherUsers = useMemo(
        () => allUsers.filter((u: any) => u._id !== userId).sort((a: any, b: any) => (a.name ?? '').localeCompare(b.name ?? '')),
        [allUsers, userId]
    );

    const createDirect = useMutation(api.chat.createDirect);
    const createGroup = useMutation(api.chat.createGroup);

    const [groupName, setGroupName] = useState('');
    const [groupMembers, setGroupMembers] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const handleStartDM = async (otherUserId: string) => {
        try {
            const result = await createDirect({ userId, otherUserId: otherUserId as Id<'users'> });
            onSelect(result.conversationId);
            setShowNewChat(false);
        } catch {
            toast.error(t('chat.createError', 'Failed to create conversation'));
        }
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim() || groupMembers.length === 0) {
            toast.error(t('chat.groupRequirements', 'Group name and at least one member required'));
            return;
        }
        try {
            const result = await createGroup({
                creatorId: userId,
                name: groupName.trim(),
                memberIds: groupMembers as Id<'users'>[],
            });
            onSelect(result.conversationId);
            setShowNewGroup(false);
            setGroupName('');
            setGroupMembers([]);
        } catch {
            toast.error(t('chat.createError', 'Failed to create conversation'));
        }
    };

    const filteredUsers = otherUsers.filter((u: any) =>
        !searchQuery || (u.name ?? u.email ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const views: { key: ConvView; label: string }[] = [
        { key: 'chats', label: t('chat.chats', 'Chats') },
        { key: 'notifications', label: t('chat.systemNotifs', 'Alerts') },
        { key: 'all', label: t('chat.filterAll', 'All') },
    ];

    const getDisplayName = (conv: any) => {
        if (conv.type === 'group') return conv.name ?? t('chat.group', 'Group');
        const other = conv.members?.find((m: any) => m.id !== userId);
        return other?.name ?? t('chat.unknownUser', 'Unknown');
    };

    const formatTime = (ts: number) => {
        const diff = Date.now() - ts;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return t('common.justNow', 'Just now');
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h`;
        const days = Math.floor(hrs / 24);
        return `${days}d`;
    };

    return (
        <div className="w-80 border-r border-gray-200 dark:border-slate-700 flex flex-col bg-white dark:bg-slate-900">
            {/* View tabs + new chat buttons */}
            <div className="px-3 pt-3 pb-2 space-y-2">
                <div className="flex gap-1">
                    {views.map((v) => (
                        <button
                            key={v.key}
                            onClick={() => onViewChange(v.key)}
                            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                view === v.key
                                    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>
                {view === 'chats' && (
                    <div className="flex gap-1.5">
                        <button
                            onClick={() => { setShowNewChat(!showNewChat); setShowNewGroup(false); }}
                            className="flex-1 px-2 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            {t('chat.newDM', '+ Direct Message')}
                        </button>
                        <button
                            onClick={() => { setShowNewGroup(!showNewGroup); setShowNewChat(false); }}
                            className="flex-1 px-2 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            {t('chat.newGroup', '+ Group')}
                        </button>
                    </div>
                )}
            </div>

            {/* New DM picker */}
            {showNewChat && (
                <div className="px-3 pb-2 border-b border-gray-100 dark:border-slate-700">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('chat.searchUsers', 'Search users...')}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="mt-1.5 max-h-40 overflow-y-auto space-y-0.5">
                        {filteredUsers.map((u: any) => (
                            <button
                                key={u._id}
                                onClick={() => handleStartDM(u._id)}
                                className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 transition-colors"
                            >
                                {u.name ?? u.email}
                                <span className="text-xs text-gray-400 ml-1.5">{u.role}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* New Group creator */}
            {showNewGroup && (
                <div className="px-3 pb-2 border-b border-gray-100 dark:border-slate-700 space-y-2">
                    <input
                        type="text"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder={t('chat.groupName', 'Group name...')}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="max-h-32 overflow-y-auto space-y-0.5">
                        {otherUsers.map((u: any) => (
                            <label key={u._id} className="flex items-center gap-2 px-2 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={groupMembers.includes(u._id)}
                                    onChange={(e) => setGroupMembers(
                                        e.target.checked
                                            ? [...groupMembers, u._id]
                                            : groupMembers.filter((id) => id !== u._id)
                                    )}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                {u.name ?? u.email}
                            </label>
                        ))}
                    </div>
                    <button
                        onClick={handleCreateGroup}
                        className="w-full px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                        {t('chat.createGroup', 'Create Group')} ({groupMembers.length})
                    </button>
                </div>
            )}

            {/* Conversation/notification list */}
            <div className="flex-1 overflow-y-auto">
                {(view === 'chats' || view === 'all') && conversations.map((conv: any) => (
                    <button
                        key={conv._id}
                        onClick={() => onSelect(conv._id)}
                        className={`w-full text-left px-3 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors border-b border-gray-50 dark:border-slate-800 ${
                            selectedConvId === conv._id ? 'bg-blue-50 dark:bg-blue-500/10' : ''
                        }`}
                    >
                        {/* Avatar */}
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white ${
                            conv.type === 'group' ? 'bg-purple-500' : 'bg-blue-500'
                        }`}>
                            {conv.type === 'group'
                                ? (conv.name ?? 'G').charAt(0).toUpperCase()
                                : getDisplayName(conv).charAt(0).toUpperCase()
                            }
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                                <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {getDisplayName(conv)}
                                </p>
                                {conv.lastMessageAt && (
                                    <span className="text-[11px] text-gray-400 dark:text-gray-500 ml-2 flex-shrink-0">
                                        {formatTime(conv.lastMessageAt)}
                                    </span>
                                )}
                            </div>
                            {conv.lastMessagePreview && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                    {conv.lastMessagePreview}
                                </p>
                            )}
                        </div>
                        {conv.unreadCount > 0 && (
                            <span className="min-w-[20px] h-5 flex items-center justify-center px-1.5 text-[10px] font-bold text-white bg-blue-600 rounded-full flex-shrink-0">
                                {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                            </span>
                        )}
                    </button>
                ))}

                {(view === 'notifications' || view === 'all') && notifications.map((notif: any) => (
                    <div
                        key={notif._id}
                        className={`px-3 py-3 border-b border-gray-50 dark:border-slate-800 ${
                            !notif.read ? 'bg-amber-50/50 dark:bg-amber-500/5' : ''
                        }`}
                    >
                        <div className="flex items-start gap-2">
                            <span className="mt-0.5 text-amber-500">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                                </svg>
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className={`text-sm ${!notif.read ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {notif.title}
                                </p>
                                {notif.body && <p className="text-xs text-gray-500 mt-0.5">{notif.body}</p>}
                                <p className="text-[11px] text-gray-400 mt-1">{formatTime(notif.createdAt)}</p>
                            </div>
                        </div>
                    </div>
                ))}

                {view === 'chats' && conversations.length === 0 && !showNewChat && !showNewGroup && (
                    <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                        {t('chat.noConversations', 'No conversations yet')}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Message Panel ───────────────────────────────────────────────────

function MessagePanel({ conversationId, userId }: { conversationId: Id<'conversations'>; userId: Id<'users'> }) {
    const { t } = useTranslation();
    const messages = useQuery(api.chat.getMessages, { conversationId, limit: 200 }) ?? [];
    const members = useQuery(api.chat.getMembers, { conversationId }) ?? [];
    const conversations = useQuery(api.chat.listConversations, { userId }) ?? [];
    const conv = conversations.find((c: any) => c._id === conversationId);

    const sendMessage = useMutation(api.chat.sendMessage);
    const markRead = useMutation(api.chat.markRead);

    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Mark conversation as read when opened
    useEffect(() => {
        markRead({ conversationId, userId });
    }, [conversationId, userId, markRead]);

    // Scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    const handleSend = useCallback(async () => {
        if (!draft.trim() || sending) return;
        setSending(true);
        try {
            await sendMessage({ conversationId, senderId: userId, body: draft.trim() });

            // Fire email notifications (fire-and-forget)
            const otherMembers = members.filter((m: any) => m.userId !== userId && m.email);
            if (otherMembers.length > 0) {
                const senderName = members.find((m: any) => m.userId === userId)?.name ?? 'Team member';
                fetch('/api/chat-notify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recipients: otherMembers.map((m: any) => m.email),
                        senderName,
                        messagePreview: draft.trim().slice(0, 100),
                        conversationName: conv?.type === 'group' ? conv?.name : undefined,
                    }),
                }).catch(() => {}); // non-blocking
            }

            setDraft('');
        } catch {
            toast.error(t('chat.sendError', 'Failed to send message'));
        } finally {
            setSending(false);
        }
    }, [draft, sending, sendMessage, conversationId, userId, members, conv, t]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const getDisplayName = () => {
        if (conv?.type === 'group') return conv?.name ?? t('chat.group', 'Group');
        const other = conv?.members?.find((m: any) => m.id !== userId);
        return other?.name ?? t('chat.unknownUser', 'Unknown');
    };

    const memberCount = members.length;

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-900">
            {/* Conversation header */}
            <div className="px-4 py-3 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    conv?.type === 'group' ? 'bg-purple-500' : 'bg-blue-500'
                }`}>
                    {getDisplayName().charAt(0).toUpperCase()}
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{getDisplayName()}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {conv?.type === 'group'
                            ? t('chat.memberCount', '{{count}} members', { count: memberCount })
                            : members.find((m: any) => m.userId !== userId)?.role ?? ''
                        }
                    </p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 && (
                    <div className="text-center text-sm text-gray-400 dark:text-gray-500 py-16">
                        {t('chat.noMessages', 'No messages yet. Start the conversation!')}
                    </div>
                )}
                {messages.map((msg: any) => {
                    const isMe = msg.senderId === userId;
                    return (
                        <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] rounded-2xl px-3.5 py-2 ${
                                isMe
                                    ? 'bg-blue-600 text-white rounded-br-sm'
                                    : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-slate-700 rounded-bl-sm'
                            }`}>
                                {!isMe && conv?.type === 'group' && (
                                    <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mb-0.5">
                                        {msg.senderName}
                                    </p>
                                )}
                                <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                                <p className={`text-[10px] mt-1 ${isMe ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`}>
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
                <div className="flex items-end gap-2">
                    <textarea
                        ref={inputRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t('chat.typePlaceholder', 'Type a message...')}
                        rows={1}
                        className="flex-1 resize-none px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 max-h-32"
                        style={{ minHeight: '38px' }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!draft.trim() || sending}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                    >
                        {sending ? '...' : t('chat.send', 'Send')}
                    </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                    {t('chat.enterToSend', 'Press Enter to send, Shift+Enter for new line')}
                </p>
            </div>
        </div>
    );
}

// ── Empty State ─────────────────────────────────────────────────────

function EmptyState({ view }: { view: ConvView }) {
    const { t } = useTranslation();
    return (
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-slate-900">
            <div className="text-center">
                <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                <p className="text-gray-400 dark:text-gray-500 text-sm">
                    {view === 'chats'
                        ? t('chat.selectConversation', 'Select a conversation or start a new one')
                        : t('chat.selectNotification', 'Select a notification to view details')}
                </p>
            </div>
        </div>
    );
}
