'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';

interface SpeechRecognitionEvent {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}
interface SpeechRecognitionErrorEvent {
    error: string;
}

export default function AIChatPanel({ onClose }: { onClose: () => void }) {
    const { t, i18n } = useTranslation();
    const [voiceMode, setVoiceMode] = useState(false);
    const [listening, setListening] = useState(false);
    const [ttsEnabled, setTtsEnabled] = useState(true);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const { data: session } = useSession();
    const pathname = usePathname();
    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: '/api/chat',
                body: {
                    userName: session?.user?.name || 'Team Member',
                    userRole: (session?.user as any)?.role || 'ADMIN',
                    currentPage: pathname,
                    preferredLang: i18n.language === 'es' ? 'ES' : 'EN',
                },
            }),
        [session?.user, pathname, i18n.language]
    );

    const { messages, sendMessage, status, error } = useChat({ transport });
    const isLoading = status === 'submitted' || status === 'streaming';

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!voiceMode) setTimeout(() => inputRef.current?.focus(), 100);
    }, [voiceMode]);

    // ── TTS ───────────────────────────────────────────────────────────
    const lastSpokenRef = useRef<string>('');

    useEffect(() => {
        if (!ttsEnabled || !voiceMode || messages.length === 0) return;
        const last = messages[messages.length - 1];
        if (last.role !== 'assistant') return;

        const text = last.parts
            ?.filter((p) => p.type === 'text')
            .map((p) => ('text' in p ? p.text : ''))
            .join(' ') || '';

        if (!text || text === lastSpokenRef.current) return;
        lastSpokenRef.current = text;

        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.05;
            window.speechSynthesis.speak(utterance);
        }
    }, [messages, voiceMode, ttsEnabled]);

    // ── Voice Input ───────────────────────────────────────────────────
    const startListening = useCallback(() => {
        if (typeof window === 'undefined') return;
        const SR =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;
        if (!SR) {
            alert('Voice input not supported. Try Chrome or Edge.');
            return;
        }

        const recognition = new SR();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => setListening(true);
        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const transcript = Array.from(event.results)
                .map((r: any) => r[0].transcript)
                .join('');

            if (event.results[0]?.isFinal) {
                sendMessage({ text: transcript });
                setInput('');
            } else {
                setInput(transcript);
            }
        };
        recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
            console.error('Speech error:', e.error);
            setListening(false);
        };
        recognition.onend = () => setListening(false);
        recognition.start();
        recognitionRef.current = recognition;
    }, [sendMessage]);

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
        setListening(false);
    }, []);

    const handleSend = useCallback(() => {
        const text = input.trim();
        if (!text || isLoading) return;
        sendMessage({ text });
        setInput('');
    }, [input, isLoading, sendMessage]);

    return (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[560px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col border border-gray-200 dark:border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white shrink-0">
                <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                    </svg>
                    <span className="font-semibold text-sm">{t('ai.title')}</span>
                    <span className="text-[10px] bg-blue-500 px-1.5 py-0.5 rounded-full">GPT-5.4n</span>
                    {(session?.user as any)?.role === 'ADMIN' && (
                        <span className="text-[10px] bg-emerald-500 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>
                            Agent
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setVoiceMode(!voiceMode)} className={`p-1.5 rounded-lg transition-colors ${voiceMode ? 'bg-blue-500 text-white' : 'text-blue-200 hover:text-white'}`} title={voiceMode ? t('ai.textMode') : t('ai.voiceMode')}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>
                    </button>
                    {voiceMode && (
                        <button onClick={() => setTtsEnabled(!ttsEnabled)} className={`p-1.5 rounded-lg transition-colors ${ttsEnabled ? 'bg-blue-500 text-white' : 'text-blue-200 hover:text-white'}`} title={ttsEnabled ? t('ai.mute') : t('ai.unmute')}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                {ttsEnabled
                                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                                    : <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                                }
                            </svg>
                        </button>
                    )}
                    <button onClick={onClose} className="p-1.5 rounded-lg text-blue-200 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.length === 0 && (
                    <div className="text-center text-gray-400 dark:text-slate-500 mt-12 space-y-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mx-auto text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>
                        <p className="text-sm font-medium">{t('ai.title')}</p>
                        <p className="text-xs">Ask about schedules, jobs, crews, or give commands like &quot;Assign Anahi to lot 42&quot;</p>
                    </div>
                )}
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100'}`}>
                            {msg.parts?.map((part, i) => {
                                if (part.type === 'text') {
                                    return <div key={i} className="whitespace-pre-wrap leading-relaxed">{part.text}</div>;
                                }
                                if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
                                    const toolName = part.type.slice(5);
                                    const state = (part as any).state;
                                    return (
                                        <div key={i} className="my-1 px-2 py-1 rounded bg-blue-50 dark:bg-slate-700 text-xs text-gray-600 dark:text-gray-300 border border-blue-100 dark:border-slate-600">
                                            <span className="font-semibold text-blue-700 dark:text-blue-300">{toolName}</span>
                                            {state === 'result' && <span className="ml-1 text-green-600 dark:text-green-400">done</span>}
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-100 dark:bg-slate-800 rounded-xl px-3 py-2">
                            <div className="flex gap-1">
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                            </div>
                        </div>
                    </div>
                )}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-300">
                        {error.message || 'Something went wrong. Try again.'}
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 dark:border-slate-700 p-3 shrink-0">
                {voiceMode ? (
                    <div className="flex flex-col items-center gap-2">
                        <button
                            onMouseDown={startListening} onMouseUp={stopListening}
                            onTouchStart={startListening} onTouchEnd={stopListening}
                            disabled={isLoading}
                            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${listening ? 'bg-red-500 text-white scale-110 animate-pulse' : 'bg-blue-600 text-white hover:bg-blue-700'} disabled:opacity-50`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{listening ? t('ai.listening') : t('ai.holdToSpeak')}</p>
                        {input && <p className="text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-800 rounded px-2 py-1 max-w-full truncate">{input}</p>}
                    </div>
                ) : (
                    <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                        <input
                            ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
                            placeholder={t('ai.placeholder')}
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isLoading}
                        />
                        <button type="button" onClick={listening ? stopListening : startListening}
                            className={`p-2 rounded-lg transition-colors ${listening ? 'bg-red-500 text-white animate-pulse' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700'}`}
                            title="Voice input"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>
                        </button>
                        <button type="submit" disabled={isLoading || !input.trim()}
                            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
