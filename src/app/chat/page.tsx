"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { v4 as uuid } from "uuid";
import ReactMarkdown from "react-markdown";
import { 
  Send, 
  Plus, 
  FileText, 
  ChevronRight, 
  Sparkles, 
  User, 
  Bot,
  Zap,
  LayoutDashboard
} from "lucide-react";
import Link from "next/link";

type ChatMessage = {
    role: "user" | "assistant";
    content: string;
};

type FileItem = {
    id: string;
    name: string;
};

export default function ChatPage() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const bottomRef = useRef<HTMLDivElement | null>(null);

    const [files, setFiles] = useState<FileItem[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);

    useEffect(() => {
        async function loadFiles() {
            const res = await fetch("/api/files");
            if (!res.ok) {
                console.error("Failed to load files");
                return;
            }
            const data = await res.json();
            const fetchedFiles: FileItem[] = data.files || [];
            setFiles(fetchedFiles);

            const hadSelection = Boolean(selectedFile);
            let nextSelection = selectedFile;

            if (
                nextSelection &&
                !fetchedFiles.some((f) => f.id === nextSelection)
            ) {
                nextSelection = null;
            }

            if (!hadSelection && !nextSelection && fetchedFiles.length > 0) {
                nextSelection = fetchedFiles[0].id;
            }

            if (nextSelection !== selectedFile) {
                setSelectedFile(nextSelection);
                if (hadSelection) {
                    resetChat();
                }
            }
        }

        loadFiles();
    }, [selectedFile]);


    useEffect(() => {
        let id = localStorage.getItem("chat_session_id");
        if (!id) {
            id = uuid();
            localStorage.setItem("chat_session_id", id);
        }
        setSessionId(id);
    }, []);

    useEffect(() => {
        if (!sessionId) return;

        async function loadHistory() {
            try {
                const res = await fetch(`/api/get-messages?session_id=${sessionId}`);
                if (!res.ok) return;
                const data = await res.json();
                setMessages(data.messages || []);
            } catch (err) {
                console.error("loadHistory error", err);
            }
        }

        loadHistory();
    }, [sessionId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isThinking]);

    async function sendMessage() {
        if (!input.trim() || !sessionId || isSending || !selectedFile) return;

        const content = input.trim();
        const userMessage: ChatMessage = { role: "user", content };

        setIsSending(true);
        setInput("");
        setMessages((prev) => [...prev, userMessage]);

        try {
            await fetch("/api/save-message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: sessionId,
                    role: "user",
                    content,
                }),
            });

            setIsThinking(true);

            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: sessionId,
                    message: content,
                    file_id: selectedFile,
                }),
            });

            if (!res.ok) {
                setIsThinking(false);
                setMessages((prev) => [...prev, { role: "assistant", content: "Error communicating with AI lab." }]);
                return;
            }

            setIsThinking(false);
            const aiMessageIndex = messages.length + 1;
            setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            let fullReply = "";

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    fullReply += chunk;

                    setMessages((prev) => {
                        const updated = [...prev];
                        updated[aiMessageIndex] = {
                            role: "assistant",
                            content: fullReply,
                        };
                        return updated;
                    });
                }
            }

            await fetch("/api/save-message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: sessionId,
                    role: "assistant",
                    content: fullReply,
                }),
            });
        } catch (err) {
            console.error(err);
            setIsThinking(false);
        } finally {
            setIsSending(false);
        }
    }

    function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    function resetChat() {
        const newSessionId = uuid();
        localStorage.setItem("chat_session_id", newSessionId);
        setSessionId(newSessionId);
        setMessages([]);
    }

    return (
        <div className="flex h-screen bg-background overflow-hidden relative">
            {/* Sidebar */}
            <aside className="w-80 glass border-r border-white/5 flex flex-col hidden md:flex z-20">
                <div className="p-6 flex items-center gap-2 border-b border-white/5">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center animate-pulse">
                        <Zap size={16} className="text-white fill-white" />
                    </div>
                    <Link href="/" className="font-bold text-xl tracking-tight">AuraChat</Link>
                </div>

                <div className="p-4 flex-1 space-y-6">
                    <div>
                        <Button onClick={resetChat} className="w-full justify-start gap-2 bg-white/5 hover:bg-white/10 text-white border-white/10 rounded-xl py-6" variant="outline">
                            <Plus size={18} />
                            New Chat
                        </Button>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-2">Knowledge Base</label>
                        <div className="space-y-1">
                            {files.length === 0 ? (
                                <p className="text-sm text-muted-foreground px-2 italic">No docs uploaded yet.</p>
                            ) : (
                                files.map((f) => (
                                    <button
                                        key={f.id}
                                        onClick={() => setSelectedFile(f.id)}
                                        className={`w-full text-left px-3 py-3 rounded-xl flex items-center gap-3 transition-all ${
                                            selectedFile === f.id 
                                            ? "bg-primary/20 text-primary border border-primary/20" 
                                            : "hover:bg-white/5 text-muted-foreground"
                                        }`}
                                    >
                                        <FileText size={16} />
                                        <span className="text-sm font-medium truncate">{f.name}</span>
                                        {selectedFile === f.id && <ChevronRight size={14} className="ml-auto" />}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 mt-auto">
                   <Link href="/">
                    <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-xl">
                        <LayoutDashboard size={18} />
                        Back to Hub
                    </Button>
                   </Link>
                </div>
            </aside>

            {/* Chat Area */}
            <main className="flex-1 flex flex-col relative z-10">
                {/* Minimal Top Header */}
                <header className="h-16 md:h-20 glass md:bg-transparent border-b md:border-b-0 border-white/5 flex items-center justify-between px-6">
                    <div className="flex items-center gap-3">
                        <div className="md:hidden w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                            <Zap size={16} className="text-white fill-white" />
                        </div>
                        <h2 className="text-lg font-bold tracking-tight">AI Agent <span className="text-primary">• Active</span></h2>
                    </div>
                </header>

                {/* Messages Container */}
                <ScrollArea className="flex-1 p-4 md:p-8">
                    <div className="max-w-3xl mx-auto space-y-8 pb-32">
                        {messages.length === 0 && !isThinking && (
                            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
                                <div className="w-20 h-20 rounded-[2.5rem] bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                                    <Sparkles size={32} className="text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black mb-2">Sup, how can I help?</h3>
                                    <p className="text-muted-foreground">Select a file from the sidebar and let&apos;s dive into the data.</p>
                                </div>
                            </div>
                        )}

                        {messages.map((msg, index) => (
                            <div 
                                key={index} 
                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-3 group animate-in fade-in slide-in-from-bottom-4 duration-300`}
                            >
                                {msg.role === "assistant" && (
                                    <div className="w-8 h-8 rounded-full glass border-white/10 flex items-center justify-center flex-shrink-0 mb-1">
                                        <Bot size={14} className="text-primary" />
                                    </div>
                                )}
                                <div 
                                    className={`relative max-w-[85%] md:max-w-[75%] px-5 py-3 rounded-[1.5rem] shadow-sm ${
                                        msg.role === "user" 
                                        ? "bg-primary text-white rounded-br-sm neon-glow" 
                                        : "glass border-white/10 rounded-bl-sm"
                                    }`}
                                >
                                    <div className={`prose prose-sm dark:prose-invert max-w-none ${msg.role === "user" ? "text-white prose-p:text-white" : ""}`}>
                                        {msg.role === "assistant" ? (
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        ) : (
                                            <p className="whitespace-pre-wrap">{msg.content}</p>
                                        )}
                                    </div>
                                </div>
                                {msg.role === "user" && (
                                    <div className="w-8 h-8 rounded-full glass border-white/10 flex items-center justify-center flex-shrink-0 mb-1">
                                        <User size={14} className="text-secondary" />
                                    </div>
                                )}
                            </div>
                        ))}

                        {isThinking && (
                            <div className="flex justify-start items-center gap-3 animate-in fade-in duration-300">
                                <div className="w-8 h-8 rounded-full glass border-white/10 flex items-center justify-center">
                                    <Bot size={14} className="text-primary" />
                                </div>
                                <div className="glass border-white/10 px-5 py-4 rounded-[1.5rem] rounded-bl-sm">
                                    <div className="flex gap-1.5">
                                        <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                        <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce"></span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>
                </ScrollArea>

                {/* Floating Input Pill */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6">
                    <div className="glass p-2 rounded-[2rem] border-white/10 shadow-2xl flex items-center gap-2 group hover:border-primary/30 transition-all focus-within:border-primary/50">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Message Aura AI..."
                            disabled={!selectedFile}
                            className="flex-1 bg-transparent border-none focus-visible:ring-0 text-lg px-4 py-6"
                        />
                        <Button
                            onClick={sendMessage}
                            disabled={isSending || !input.trim() || !selectedFile}
                            size="icon"
                            className="bg-primary hover:bg-primary/90 text-white rounded-full w-12 h-12 flex-shrink-0"
                        >
                            <Send size={18} />
                        </Button>
                    </div>
                    {!selectedFile && (
                        <p className="mt-3 text-center text-xs font-bold text-primary/80 tracking-widest uppercase animate-pulse">
                            Pick a file to start decoding
                        </p>
                    )}
                </div>
            </main>
        </div>
    );
}
