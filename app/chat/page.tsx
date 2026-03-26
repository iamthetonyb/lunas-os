'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useConvexUser } from '@/hooks/useConvexUser';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { Id } from '@/convex/_generated/dataModel';
// PageHeader replaced with inline header for chat-specific layout

type ConvView = 'chats' | 'notifications' | 'all';

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
    // Mobile: show message panel instead of list
    const [mobileShowMessages, setMobileShowMessages] = useState(!!selectedConvParam);

    useEffect(() => {
        if (selectedConvParam) {
            setSelectedConvId(selectedConvParam);
            setMobileShowMessages(true);
        }
    }, [selectedConvParam]);

    const handleSelectConv = (id: string | null) => {
        setSelectedConvId(id);
        if (id) setMobileShowMessages(true);
    };

    const handleMobileBack = () => {
        setMobileShowMessages(false);
    };

    if (!userId) {
        return (
            <div className="flex items-center justify-center h-96">
                <p className="text-gray-400 dark:text-gray-500">{t('common.loading', 'Loading...')}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-48px)]">
            {/* Header with title + new message buttons */}
            <div className="px-4 sm:px-6 py-3 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{t('chat.title', 'Messages')}</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">{t('chat.description', 'Team chat & notifications')}</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => { setShowNewChat(!showNewChat); setShowNewGroup(false); }}
                        className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors min-h-[36px] ${
                            showNewChat
                                ? 'bg-blue-600 text-white'
                                : 'border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                        }`}
                    >
                        {t('chat.newDM', '+ Direct Message')}
                    </button>
                    <button
                        onClick={() => { setShowNewGroup(!showNewGroup); setShowNewChat(false); }}
                        className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors min-h-[36px] ${
                            showNewGroup
                                ? 'bg-blue-600 text-white'
                                : 'border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                        }`}
                    >
                        {t('chat.newGroup', '+ Group')}
                    </button>
                </div>
            </div>
            <div className="flex flex-1 min-h-0">
                {/* Left panel — hide on mobile when viewing messages */}
                <div className={`${mobileShowMessages ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-shrink-0 border-r border-gray-200 dark:border-slate-700 flex-col bg-white dark:bg-slate-900`}>
                    <ConversationList
                        userId={userId}
                        selectedConvId={selectedConvId}
                        onSelect={handleSelectConv}
                        view={view}
                        onViewChange={setView}
                        showNewChat={showNewChat}
                        setShowNewChat={setShowNewChat}
                        showNewGroup={showNewGroup}
                        setShowNewGroup={setShowNewGroup}
                    />
                </div>
                {/* Right panel — full screen on mobile */}
                <div className={`${!mobileShowMessages ? 'hidden md:flex' : 'flex'} flex-1 flex-col min-w-0`}>
                    {selectedConvId ? (
                        <MessagePanel
                            conversationId={selectedConvId as Id<'conversations'>}
                            userId={userId}
                            onBack={handleMobileBack}
                        />
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

    // getUsers returns { id, name, email, systemRole, ... } — NOT _id
    const allUsers = useQuery(api.queries.getUsers, { limit: 200 }) ?? [];
    const otherUsers = useMemo(
        () => allUsers
            .filter((u: any) => u.id !== userId)
            .sort((a: any, b: any) => (a.name ?? '').localeCompare(b.name ?? '')),
        [allUsers, userId]
    );

    const createDirect = useMutation(api.chat.createDirect);
    const createGroup = useMutation(api.chat.createGroup);

    const [groupName, setGroupName] = useState('');
    const [groupMembers, setGroupMembers] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const handleStartDM = async (otherUserId: string) => {
        if (!otherUserId) return;
        try {
            const result = await createDirect({ userId, otherUserId: otherUserId as Id<'users'> });
            onSelect(result.conversationId);
            setShowNewChat(false);
            setSearchQuery('');
        } catch {
            toast.error(t('chat.createError', 'Failed to create conversation'));
        }
    };

    const handleCreateGroup = async () => {
        if (groupMembers.length === 0) {
            toast.error(t('chat.groupRequirements', 'Select at least one member'));
            return;
        }
        // Auto-generate group name from member names if not provided
        const name = groupName.trim() || groupMembers
            .map((uid) => otherUsers.find((u: any) => u.id === uid)?.name ?? 'User')
            .join(', ');
        try {
            const result = await createGroup({
                creatorId: userId,
                name,
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

    const toggleGroupMember = (uid: string) => {
        setGroupMembers((prev) =>
            prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
        );
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
        <>
            {/* View tabs */}
            <div className="px-3 pt-3 pb-2">
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
                    <div className="mt-1.5 max-h-48 overflow-y-auto space-y-0.5">
                        {filteredUsers.map((u: any) => (
                            <button
                                key={u.id}
                                onClick={() => handleStartDM(u.id)}
                                className="w-full text-left px-2 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 transition-colors min-h-[44px] flex items-center"
                            >
                                <span className="truncate">{u.name ?? u.email}</span>
                                <span className="text-xs text-gray-400 ml-1.5 flex-shrink-0">{u.systemRole}</span>
                            </button>
                        ))}
                        {filteredUsers.length === 0 && (
                            <p className="text-xs text-gray-400 py-3 text-center">{t('common.noData', 'No data available')}</p>
                        )}
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
                        placeholder={t('chat.groupNameOptional', 'Group name (optional)')}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                        {otherUsers.map((u: any) => (
                            <label
                                key={u.id}
                                className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded cursor-pointer min-h-[44px]"
                            >
                                <input
                                    type="checkbox"
                                    checked={groupMembers.includes(u.id)}
                                    onChange={() => toggleGroupMember(u.id)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                />
                                <span className="truncate">{u.name ?? u.email}</span>
                            </label>
                        ))}
                    </div>
                    <button
                        onClick={handleCreateGroup}
                        disabled={groupMembers.length === 0}
                        className="w-full px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
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
                        className={`w-full text-left px-3 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors border-b border-gray-50 dark:border-slate-800 min-h-[56px] ${
                            selectedConvId === conv._id ? 'bg-blue-50 dark:bg-blue-500/10' : ''
                        }`}
                    >
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
                        className={`px-3 py-3 border-b border-gray-50 dark:border-slate-800 min-h-[56px] ${
                            !notif.read ? 'bg-amber-50/50 dark:bg-amber-500/5' : ''
                        }`}
                    >
                        <div className="flex items-start gap-2">
                            <span className="mt-0.5 text-amber-500 flex-shrink-0">
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
        </>
    );
}

// ── Message Panel ───────────────────────────────────────────────────

function MessagePanel({
    conversationId, userId, onBack,
}: {
    conversationId: Id<'conversations'>;
    userId: Id<'users'>;
    onBack: () => void;
}) {
    const { t } = useTranslation();
    const messages = useQuery(api.chat.getMessages, { conversationId, userId, limit: 200 }) ?? [];
    const members = useQuery(api.chat.getMembers, { conversationId }) ?? [];
    const conversations = useQuery(api.chat.listConversations, { userId }) ?? [];
    const conv = conversations.find((c: any) => c._id === conversationId);

    const allUsers = useQuery(api.queries.getUsers, { limit: 200 }) ?? [];
    const nonMembers = useMemo(() => {
        const memberIds = new Set(members.map((m: any) => m.userId));
        return allUsers
            .filter((u: any) => !memberIds.has(u.id))
            .sort((a: any, b: any) => (a.name ?? '').localeCompare(b.name ?? ''));
    }, [allUsers, members]);

    const sendMessage = useMutation(api.chat.sendMessage);
    const markRead = useMutation(api.chat.markRead);
    const updateGroupName = useMutation(api.chat.updateGroupName);
    const addMember = useMutation(api.chat.addMember);
    const removeMember = useMutation(api.chat.removeMember);

    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [showGroupSettings, setShowGroupSettings] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [showAddMember, setShowAddMember] = useState(false);
    const [addMemberSearch, setAddMemberSearch] = useState('');
    const [historyOption, setHistoryOption] = useState<'all' | 'from_now'>('all');
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        markRead({ conversationId, userId });
    }, [conversationId, userId, markRead]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    const handleSend = useCallback(async () => {
        if (!draft.trim() || sending) return;
        setSending(true);
        try {
            await sendMessage({ conversationId, senderId: userId, body: draft.trim() });

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
                }).catch(() => {});
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

    const handleSaveName = async () => {
        if (!nameInput.trim()) return;
        try {
            await updateGroupName({ conversationId, name: nameInput.trim() });
            setEditingName(false);
            toast.success(t('chat.nameUpdated', 'Group name updated'));
        } catch {
            toast.error(t('chat.nameUpdateError', 'Failed to update group name'));
        }
    };

    const handleAddMember = async (uid: string) => {
        try {
            await addMember({
                conversationId,
                userId: uid as Id<'users'>,
                historyAccess: historyOption,
            });
            setAddMemberSearch('');
            toast.success(t('chat.memberAdded', 'Member added'));
        } catch {
            toast.error(t('chat.memberAddError', 'Failed to add member'));
        }
    };

    const handleRemoveMember = async (uid: string) => {
        try {
            await removeMember({ conversationId, userId: uid as Id<'users'> });
            toast.success(t('chat.memberRemoved', 'Member removed'));
        } catch {
            toast.error(t('chat.memberRemoveError', 'Failed to remove member'));
        }
    };

    const filteredNonMembers = nonMembers.filter((u: any) =>
        !addMemberSearch || (u.name ?? u.email ?? '').toLowerCase().includes(addMemberSearch.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-900">
            {/* Conversation header */}
            <div className="px-3 sm:px-4 py-3 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center gap-3">
                {/* Mobile back button */}
                <button
                    onClick={onBack}
                    className="md:hidden p-1.5 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label={t('common.back', 'Back')}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                </button>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                    conv?.type === 'group' ? 'bg-purple-500' : 'bg-blue-500'
                }`}>
                    {getDisplayName().charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{getDisplayName()}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {conv?.type === 'group'
                            ? t('chat.memberCount', '{{count}} members', { count: members.length })
                            : members.find((m: any) => m.userId !== userId)?.role ?? ''
                        }
                    </p>
                </div>
                {/* Group settings gear */}
                {conv?.type === 'group' && (
                    <button
                        onClick={() => setShowGroupSettings(!showGroupSettings)}
                        className={`p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
                            showGroupSettings
                                ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                        }`}
                        aria-label={t('chat.groupSettings', 'Group settings')}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Group settings panel (slide-in below header) */}
            {showGroupSettings && conv?.type === 'group' && (
                <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-3 sm:px-4 py-3 space-y-3 max-h-[50vh] overflow-y-auto">
                    {/* Group name edit */}
                    <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            {t('chat.groupName', 'Group Name')}
                        </label>
                        {editingName ? (
                            <div className="flex gap-2 mt-1">
                                <input
                                    type="text"
                                    value={nameInput}
                                    onChange={(e) => setNameInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                    className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 min-h-[36px]"
                                    autoFocus
                                />
                                <button onClick={handleSaveName} className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 min-h-[36px]">
                                    {t('common.save', 'Save')}
                                </button>
                                <button onClick={() => setEditingName(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 min-h-[36px]">
                                    {t('common.cancel', 'Cancel')}
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-sm text-gray-900 dark:text-white">{conv.name ?? t('chat.group', 'Group')}</p>
                                <button
                                    onClick={() => { setNameInput(conv.name ?? ''); setEditingName(true); }}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    {t('common.edit', 'Edit')}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Members list */}
                    <div>
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                {t('chat.members', 'Members')} ({members.length})
                            </label>
                            <button
                                onClick={() => setShowAddMember(!showAddMember)}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                {showAddMember ? t('common.cancel', 'Cancel') : t('chat.addMember', '+ Add Member')}
                            </button>
                        </div>
                        <div className="mt-1.5 space-y-0.5">
                            {members.map((m: any) => (
                                <div key={m.userId} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                    <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                                        {(m.name ?? '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-gray-900 dark:text-white truncate">
                                            {m.name}
                                            {m.userId === userId && (
                                                <span className="text-xs text-gray-400 ml-1">({t('common.you', 'you')})</span>
                                            )}
                                        </p>
                                        <p className="text-[11px] text-gray-400">{m.role ?? ''}</p>
                                    </div>
                                    {m.userId !== userId && m.userId !== conv.createdBy && (
                                        <button
                                            onClick={() => handleRemoveMember(m.userId)}
                                            className="text-xs text-red-500 hover:text-red-700 px-1.5 py-0.5"
                                        >
                                            {t('common.remove', 'Remove')}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Add member panel */}
                    {showAddMember && (
                        <div className="border-t border-gray-100 dark:border-slate-700 pt-3 space-y-2">
                            {/* History access control */}
                            <div>
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                    {t('chat.historyAccess', 'Chat history access')}
                                </label>
                                <div className="flex gap-2 mt-1">
                                    <button
                                        onClick={() => setHistoryOption('all')}
                                        className={`flex-1 px-2 py-1.5 text-xs rounded-md border transition-colors ${
                                            historyOption === 'all'
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                                                : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        {t('chat.allHistory', 'Full history')}
                                    </button>
                                    <button
                                        onClick={() => setHistoryOption('from_now')}
                                        className={`flex-1 px-2 py-1.5 text-xs rounded-md border transition-colors ${
                                            historyOption === 'from_now'
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                                                : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        {t('chat.fromNowOnly', 'New messages only')}
                                    </button>
                                </div>
                            </div>
                            {/* User search */}
                            <input
                                type="text"
                                value={addMemberSearch}
                                onChange={(e) => setAddMemberSearch(e.target.value)}
                                placeholder={t('chat.searchUsers', 'Search users...')}
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                            />
                            <div className="max-h-36 overflow-y-auto space-y-0.5">
                                {filteredNonMembers.map((u: any) => (
                                    <button
                                        key={u.id}
                                        onClick={() => handleAddMember(u.id)}
                                        className="w-full text-left px-2 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors min-h-[44px] flex items-center gap-2"
                                    >
                                        <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                                            {(u.name ?? '?').charAt(0).toUpperCase()}
                                        </div>
                                        <span className="truncate">{u.name ?? u.email}</span>
                                        <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{u.systemRole}</span>
                                    </button>
                                ))}
                                {filteredNonMembers.length === 0 && (
                                    <p className="text-xs text-gray-400 py-3 text-center">
                                        {t('chat.noUsersToAdd', 'No users available to add')}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-3">
                {messages.length === 0 && (
                    <div className="text-center text-sm text-gray-400 dark:text-gray-500 py-16">
                        {t('chat.noMessages', 'No messages yet. Start the conversation!')}
                    </div>
                )}
                {messages.map((msg: any) => {
                    const isMe = msg.senderId === userId;
                    return (
                        <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 ${
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
            <div className="px-3 sm:px-4 py-3 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
                <div className="flex items-end gap-2">
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t('chat.typePlaceholder', 'Type a message...')}
                        rows={1}
                        className="flex-1 resize-none px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 max-h-32 min-h-[44px]"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!draft.trim() || sending}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 min-h-[44px] min-w-[44px]"
                    >
                        {sending ? '...' : t('chat.send', 'Send')}
                    </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1 hidden sm:block">
                    {t('chat.enterToSend', 'Press Enter to send, Shift+Enter for new line')}
                </p>
            </div>
        </div>
    );
}

function EmptyState({ view }: { view: ConvView }) {
    const { t } = useTranslation();
    return (
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-slate-900">
            <div className="text-center px-4">
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
