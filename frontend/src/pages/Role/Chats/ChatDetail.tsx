"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, Video, Phone, Smile, Paperclip, Camera, Mic, Send, Users } from 'lucide-react';

const MOCK_CHATS: Record<string, { name: string; participants: string }> = {
    '1': { name: 'Alpha Tower Team', participants: 'Sarah, David, Michael, You' },
    '2': { name: 'Sarah Jenkins', participants: 'Client' },
    '3': { name: 'Site Managers', participants: 'Michael, You' },
    '4': { name: 'David Chen', participants: 'Contributor' },
};

const MOCK_MESSAGES = [
    {
        id: 'sys-1',
        type: 'system',
        text: 'Admin created group "Alpha Tower Team"',
        time: '11:00 AM',
    },
    {
        id: 'sys-2',
        type: 'system',
        text: 'Sarah (Client) joined using invite code A1B2',
        time: '11:05 AM',
    },
    {
        id: 'msg-1',
        type: 'received',
        sender: 'Sarah (Client)',
        text: 'Hi everyone! I just joined visually through the app.',
        time: '11:10 AM',
    },
    {
        id: 'msg-2',
        type: 'sent',
        sender: 'Admin',
        text: 'Welcome Sarah! Have you checked the latest site snags?',
        time: '11:15 AM',
    },
    {
        id: 'sys-3',
        type: 'system',
        text: 'Admin added David (Contributor) recently',
        time: '12:45 PM',
    },
    {
        id: 'msg-3',
        type: 'received',
        sender: 'David Chen',
        text: 'Can you upload the latest drawings?',
        time: '12:50 PM',
    },
];

export default function ChatDetail() {
    const router = useRouter();
    const params = useParams();
    const role = params?.role as string ?? 'admin';
    const id = params?.id as string ?? '1';
    const chat = MOCK_CHATS[id] ?? MOCK_CHATS['1'];

    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState(MOCK_MESSAGES);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!message.trim()) return;
        setMessages(prev => [
            ...prev,
            {
                id: `msg-${Date.now()}`,
                type: 'sent',
                sender: 'You',
                text: message.trim(),
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
        ]);
        setMessage('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0">
                <button
                    onClick={() => router.push(`/${role}/chats`)}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-[#f97316]"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="w-9 h-9 rounded-full bg-[#f97316] flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-sm truncate">{chat.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{chat.participants}</p>
                </div>

                <div className="flex items-center gap-2">
                    <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-[#f97316]">
                        <Video className="h-5 w-5" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-[#f97316]">
                        <Phone className="h-4.5 w-4.5" />
                    </button>
                </div>
            </div>

            {/* Chat Background + Messages */}
            <div
                className="flex-1 overflow-y-auto px-4 py-4 space-y-2"
                style={{ background: 'var(--chat-bg, #efeae2)' }}
            >
                <style>{`
                    :root { --chat-bg: #efeae2; }
                    .dark { --chat-bg: #0b141a; }
                `}</style>

                {messages.map(msg => {
                    if (msg.type === 'system') {
                        return (
                            <div key={msg.id} className="flex justify-center my-3">
                                <div className="bg-amber-50 dark:bg-card border border-amber-200 dark:border-border text-[#f97316] text-xs font-medium px-3 py-1.5 rounded-full max-w-xs text-center">
                                    {msg.text}
                                </div>
                            </div>
                        );
                    }

                    const isMe = msg.type === 'sent';
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className={`max-w-[75%] px-3.5 py-2.5 shadow-sm ${isMe
                                        ? 'bg-[#f97316] text-white rounded-2xl rounded-br-sm'
                                        : 'bg-card text-foreground border border-border rounded-2xl rounded-bl-sm'
                                    }`}
                            >
                                {!isMe && (
                                    <p className="text-[#f97316] text-xs font-semibold mb-1">{msg.sender}</p>
                                )}
                                <p className="text-sm leading-relaxed">{msg.text}</p>
                                <div className={`flex items-center gap-1 mt-1 justify-end`}>
                                    <span className={`text-[10px] ${isMe ? 'text-orange-100' : 'text-muted-foreground'}`}>
                                        {msg.time}
                                    </span>
                                    {isMe && (
                                        <svg className="w-3.5 h-3.5 text-orange-100" viewBox="0 0 16 11" fill="currentColor">
                                            <path d="M11.071.653a.75.75 0 0 1 .082 1.057L5.97 8.421l-2.75-2.75A.75.75 0 0 1 4.28 4.61l1.69 1.69 4.046-5.565a.75.75 0 0 1 1.056-.082z" />
                                            <path d="M14.571.653a.75.75 0 0 1 .082 1.057L9.47 8.421 8.5 7.45l4.714-6.715a.75.75 0 0 1 1.057-.082z" />
                                        </svg>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {/* Input Area */}
            <div className="bg-card border-t border-border px-3 py-3 flex items-end gap-2 shrink-0">
                <div className="flex-1 flex items-end bg-secondary/50 border border-border rounded-2xl px-3 py-2 gap-2 min-h-[44px]">
                    <button className="text-muted-foreground hover:text-foreground transition-colors pb-0.5">
                        <Smile className="h-5 w-5" />
                    </button>
                    <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Message..."
                        rows={1}
                        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none max-h-24 py-0.5"
                        style={{ lineHeight: '1.4' }}
                    />
                    <button className="text-muted-foreground hover:text-foreground transition-colors rotate-[-45deg] pb-0.5">
                        <Paperclip className="h-5 w-5" />
                    </button>
                    {!message && (
                        <button className="text-muted-foreground hover:text-foreground transition-colors pb-0.5">
                            <Camera className="h-5 w-5" />
                        </button>
                    )}
                </div>

                <button
                    onClick={handleSend}
                    className="w-11 h-11 rounded-full bg-[#f97316] flex items-center justify-center shrink-0 hover:bg-[#ea6c10] transition-colors shadow-md"
                >
                    {message ? (
                        <Send className="h-4.5 w-4.5 text-white translate-x-0.5" />
                    ) : (
                        <Mic className="h-5 w-5 text-white" />
                    )}
                </button>
            </div>
        </div>
    );
}
