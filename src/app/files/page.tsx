"use client";

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUpload } from "@/components/ui/file-upload";
import { Switch } from "@/components/ui/switch";
import { SyncGoogleSheetButton } from "@/components/ui/sync-google-sheet-button";
import { SaveGoogleSheet } from "@/components/ui/save-google-sheet";
import { SyncGoogleDocButton } from "@/components/ui/sync-google-doc-button";
import { SaveGoogleDoc } from "@/components/ui/save-google-doc";
import {
    Smartphone,
    Plus,
    Trash2,
    Settings,
    FileText,
    Database,
    Globe,
    Key,
    Sparkles,
    Zap,
    Code,
    LayoutDashboard,
    ShieldCheck,
    Link as LinkIcon,
    RefreshCcw,
    Bot
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/* ================= TYPES ================= */

type FileItem = {
    id: string;
    name: string;
    file_type: string;
    chunk_count?: number;
    created_at: string;
};

type PhoneNumberGroup = {
    phone_number: string;
    intent: string | null;
    system_prompt: string | null;
    files: FileItem[];
    auth_token: string;
    origin: string;
    gemini_api_key: string | null;
    groq_api_key: string | null;
    mistral_api_key: string | null;
};

/* ================= COMPONENT ================= */

export default function FilesPage() {
    const [phoneGroups, setPhoneGroups] = useState<PhoneNumberGroup[]>([]);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [generatingPrompt, setGeneratingPrompt] = useState(false);

    const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string | null>(null);

    const [editPhoneNumber, setEditPhoneNumber] = useState("");
    const [editIntent, setEditIntent] = useState("");
    const [editAuthToken, setEditAuthToken] = useState("");
    const [editOrigin, setEditOrigin] = useState("");
    const [editSystemPrompt, setEditSystemPrompt] = useState("");
    const [editGeminiKey, setEditGeminiKey] = useState("");
    const [editGroqKey, setEditGroqKey] = useState("");
    const [editMistralKey, setEditMistralKey] = useState("");
    const [isNewPhone, setIsNewPhone] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);

    const [devMode, setDevMode] = useState(false);
    const [processingMode, setProcessingMode] = useState<"ocr" | "transcribe">("transcribe");
    const [devInfo, setDevInfo] = useState<{ extractedText?: string, chunks?: number, mode?: string } | null>(null);

    const loadPhoneGroups = useCallback(async () => {
        try {
            const res = await fetch("/api/phone-groups");
            const data = await res.json();
            if (data.success) {
                setPhoneGroups(data.groups || []);
            }
        } catch (error) {
            console.error("Error loading phone groups:", error);
        }
    }, []);

    useEffect(() => {
        void loadPhoneGroups();
    }, [loadPhoneGroups]);

    useEffect(() => {
        if (selectedPhoneNumber) {
            const group = phoneGroups.find(g => g.phone_number === selectedPhoneNumber);
            if (group) {
                setEditPhoneNumber(group.phone_number);
                setEditIntent(group.intent || "");
                setEditAuthToken(group.auth_token || "");
                setEditOrigin(group.origin || "");
                setEditSystemPrompt(group.system_prompt || "");
                setEditGeminiKey(group.gemini_api_key || "");
                setEditGroqKey(group.groq_api_key || "");
                setEditMistralKey(group.mistral_api_key || "");
                setIsNewPhone(false);
            }
        }
    }, [selectedPhoneNumber, phoneGroups]);

    function handleFileSelect(file: File) {
        setSelectedFile(file);
    }

    function handleNewPhone() {
        setSelectedPhoneNumber(null);
        setEditPhoneNumber("");
        setEditIntent("");
        setEditAuthToken("");
        setEditOrigin("");
        setEditSystemPrompt("");
        setEditGeminiKey("");
        setEditGroqKey("");
        setEditMistralKey("");
        setSelectedFile(null);
        setIsNewPhone(true);
        setDevInfo(null);
    }

    async function generateSystemPrompt() {
        if (!editIntent.trim() || !editPhoneNumber.trim()) {
            alert("Please provide both phone number and intent");
            return;
        }

        setGeneratingPrompt(true);
        try {
            const res = await fetch("/api/generate-system-prompt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    intent: editIntent.trim(),
                    phone_number: editPhoneNumber.trim(),
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to generate system prompt");

            setEditSystemPrompt(data.system_prompt);
            setEditIntent(data.intent);

            alert("System prompt generated successfully!");
            await loadPhoneGroups();

            if (isNewPhone) {
                setSelectedPhoneNumber(editPhoneNumber.trim());
                setIsNewPhone(false);
            }
        } catch (err) {
            console.error(err);
            alert(err instanceof Error ? err.message : "Failed to generate system prompt");
        } finally {
            setGeneratingPrompt(false);
        }
    }

    async function handleUpload() {
        if (!selectedFile || !editPhoneNumber.trim() || !editAuthToken.trim() || !editOrigin.trim()) {
            alert("Please provide all required fields and a file.");
            return;
        }

        const form = new FormData();
        form.append("file", selectedFile);
        form.append("phone_number", editPhoneNumber.trim());
        form.append("auth_token", editAuthToken.trim());
        form.append("origin", editOrigin.trim());
        form.append("gemini_api_key", editGeminiKey.trim());
        form.append("groq_api_key", editGroqKey.trim());
        form.append("mistral_api_key", editMistralKey.trim());
        form.append("dev_mode", devMode.toString());
        form.append("processing_mode", processingMode);

        if (editIntent.trim()) form.append("intent", editIntent.trim());

        setUploading(true);
        try {
            const res = await fetch("/api/process-file", { method: "POST", body: form });
            const payload = await res.json();
            if (!res.ok) throw new Error(payload?.error ?? "Failed to process file");

            alert(`Success! ${payload.chunks} chunks processed.`);
            setSelectedFile(null);
            if (devMode) setDevInfo({ extractedText: payload.extractedText, chunks: payload.chunks, mode: payload.processingMode });
            await loadPhoneGroups();
            setSelectedPhoneNumber(editPhoneNumber.trim());
            setIsNewPhone(false);
        } catch (error) {
            console.error(error);
            alert("Upload error.");
        } finally {
            setUploading(false);
        }
    }

    async function deleteFile(fileId: string) {
        if (!confirm("Delete this file?")) return;
        try {
            const res = await fetch(`/api/files?id=${fileId}`, { method: "DELETE" });
            if (res.ok) await loadPhoneGroups();
        } catch (error) {
            console.error(error);
        }
    }

    async function deletePhoneNumber(phoneNum: string) {
        if (!confirm("Delete this bot configuration?")) return;
        try {
            const res = await fetch(`/api/phone-mappings?phone_number=${phoneNum}`, { method: "DELETE" });
            if (res.ok) {
                setSelectedPhoneNumber(null);
                await loadPhoneGroups();
            }
        } catch (error) {
            console.error(error);
        }
    }

    async function savePhoneSettings() {
        if (!editPhoneNumber.trim()) return;
        setSavingSettings(true);
        try {
            const res = await fetch("/api/update-phone-settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone_number: editPhoneNumber.trim(),
                    intent: editIntent.trim() || null,
                    system_prompt: editSystemPrompt.trim() || null,
                    auth_token: editAuthToken.trim() || null,
                    origin: editOrigin.trim() || null,
                    gemini_api_key: editGeminiKey.trim() || null,
                    groq_api_key: editGroqKey.trim() || null,
                    mistral_api_key: editMistralKey.trim() || null,
                }),
            });
            if (res.ok) {
                alert("Settings saved successfully.");
                await loadPhoneGroups();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSavingSettings(false);
        }
    }

    const selectedGroup = phoneGroups.find(g => g.phone_number === selectedPhoneNumber);

    return (
        <div className="flex h-screen bg-[#f8fafc] overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full shrink-0">
                <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2563eb] flex items-center justify-center text-white shadow-sm">
                        <Bot size={18} />
                    </div>
                    <div>
                        <h1 className="font-bold text-base text-slate-900 leading-none">AuraChat</h1>
                        <p className="text-[10px] font-medium text-slate-500 mt-1">v1.2 Admin</p>
                    </div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto space-y-6">
                    <Button
                        onClick={handleNewPhone}
                        className="w-full gap-2 rounded-lg py-5 bg-[#2563eb] text-white font-semibold text-xs transition-all shadow-sm shadow-blue-100"
                    >
                        <Plus size={16} />
                        Add New Bot
                    </Button>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">Your Bots</label>
                        {phoneGroups.map((group) => (
                            <button
                                key={group.phone_number}
                                onClick={() => setSelectedPhoneNumber(group.phone_number)}
                                className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center justify-between group ${selectedPhoneNumber === group.phone_number
                                        ? "bg-blue-50 text-[#2563eb]"
                                        : "hover:bg-slate-50 text-slate-600"
                                    }`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <Smartphone size={14} className={selectedPhoneNumber === group.phone_number ? "text-[#2563eb]" : "text-slate-400"} />
                                    <span className="text-xs font-medium truncate max-w-[100px]">{group.phone_number}</span>
                                </div>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${selectedPhoneNumber === group.phone_number ? "bg-blue-100" : "bg-slate-100"}`}>
                                    {group.files.length}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100">
                    <Link href="/chat">
                        <Button variant="ghost" className="w-full justify-start gap-3 rounded-lg py-5 hover:bg-slate-50 text-slate-500 text-xs font-semibold">
                            <LayoutDashboard size={16} />
                            Go to Console
                        </Button>
                    </Link>
                </div>
            </aside>

            {/* Main Area */}
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto py-12 px-8">
                    {selectedPhoneNumber || isNewPhone ? (
                        <div className="animate-in fade-in duration-300">
                            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 pb-6 border-b border-slate-200">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                                        {isNewPhone ? "Bot Initializer" : "Bot Settings"}
                                    </h2>
                                    <p className="text-slate-500 font-medium text-sm">
                                        Configure logic, API keys, and knowledge sources.
                                    </p>
                                </div>
                                {selectedPhoneNumber && (
                                    <Button onClick={() => deletePhoneNumber(selectedPhoneNumber)} variant="ghost" className="text-slate-400 hover:text-red-600 hover:bg-red-50 text-xs font-semibold h-9 px-4">
                                        <Trash2 size={16} className="mr-2" />
                                        Delete Bot
                                    </Button>
                                )}
                            </header>

                            <Tabs defaultValue="configuration" className="w-full">
                                <TabsList className="bg-slate-100 border border-slate-200 p-1 rounded-lg h-auto gap-0.5 mb-8 w-fit flex shadow-sm">
                                    <TabsTrigger value="configuration" className="rounded px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-[#2563eb] data-[state=active]:shadow-sm transition-all font-semibold text-xs flex items-center gap-2">
                                        <Settings size={14} />
                                        Configuration
                                    </TabsTrigger>
                                    <TabsTrigger value="files" className="rounded px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-[#2563eb] data-[state=active]:shadow-sm transition-all font-semibold text-xs flex items-center gap-2">
                                        <Database size={14} />
                                        Knowledge Base
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="configuration" className="space-y-8 pb-20">
                                    {/* Bot Identity Card */}
                                    <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm space-y-8">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                                                <Smartphone size={20} />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-900">Bot Identity</h3>
                                                <p className="text-slate-400 text-xs">Primary connection parameters.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-500 px-1">WhatsApp Number</label>
                                                <input
                                                    type="text"
                                                    value={editPhoneNumber}
                                                    onChange={(e) => setEditPhoneNumber(e.target.value)}
                                                    disabled={!isNewPhone}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all text-sm font-medium disabled:opacity-50"
                                                    placeholder="e.g. 15550001234"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-500 px-1">Bot Persona / Intent</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={editIntent}
                                                        onChange={(e) => setEditIntent(e.target.value)}
                                                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all text-sm font-medium"
                                                        placeholder="e.g. Real Estate Agent"
                                                    />
                                                    <Button onClick={generateSystemPrompt} disabled={generatingPrompt} className="bg-slate-900 text-white px-6 rounded-lg text-xs font-bold transition-all">
                                                        {generatingPrompt ? <RefreshCcw size={14} className="animate-spin" /> : "Auto-Gen"}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {editSystemPrompt && (
                                            <div className="space-y-3 pt-6 border-t border-slate-100">
                                                <div className="flex items-center justify-between px-1">
                                                    <label className="text-xs font-semibold text-slate-500">System Prompt</label>
                                                    <span className="text-[10px] font-bold text-[#2563eb] bg-blue-50 px-2.5 py-1 rounded-full uppercase border border-blue-100">Active Behavior</span>
                                                </div>
                                                <textarea
                                                    value={editSystemPrompt}
                                                    onChange={(e) => setEditSystemPrompt(e.target.value)}
                                                    rows={10}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all text-sm font-medium leading-relaxed text-slate-600 shadow-inner"
                                                    placeholder="Define how the AI should behave..."
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Connection & Security Card */}
                                    <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm space-y-8">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                                                <ShieldCheck size={20} />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-900">Connections</h3>
                                                <p className="text-slate-400 text-xs">Auth tokens and web endpoints.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-500 px-1">Auth Token</label>
                                                <input
                                                    type="password"
                                                    value={editAuthToken}
                                                    onChange={(e) => setEditAuthToken(e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all text-sm font-medium"
                                                    placeholder="Enter secret token"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-500 px-1">Web Origin / API Base</label>
                                                <input
                                                    type="text"
                                                    value={editOrigin}
                                                    onChange={(e) => setEditOrigin(e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all text-sm font-medium"
                                                    placeholder="https://your-api.com"
                                                />
                                            </div>
                                        </div>

                                        <div className="pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {[
                                                { label: "Gemini Key", val: editGeminiKey, set: setEditGeminiKey },
                                                { label: "Groq Key", val: editGroqKey, set: setEditGroqKey },
                                                { label: "Mistral Key", val: editMistralKey, set: setEditMistralKey }
                                            ].map((api) => (
                                                <div key={api.label} className="space-y-2">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{api.label}</label>
                                                    <input
                                                        type="password"
                                                        value={api.val}
                                                        onChange={e => api.set(e.target.value)}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:bg-white focus:outline-none transition-all"
                                                        placeholder="sk-..."
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <div className="pt-6">
                                            <Button
                                                onClick={savePhoneSettings}
                                                disabled={savingSettings || isNewPhone}
                                                className="w-full py-6 rounded-lg bg-[#2563eb] text-white font-bold text-sm shadow-md shadow-blue-100 hover:translate-y-[-1px] active:translate-y-[0px] transition-all"
                                            >
                                                {savingSettings ? <RefreshCcw className="animate-spin mr-2" size={16} /> : <Zap className="mr-2" size={16} />}
                                                {savingSettings ? "Saving..." : "Save Bot Configuration"}
                                            </Button>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="files" className="space-y-8 pb-20">
                                    {/* Webhook Card */}
                                    <div className="bg-blue-600 rounded-xl p-8 shadow-md text-white flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                            <Globe size={160} />
                                        </div>
                                        <div className="flex-1 space-y-4 relative z-10 text-center md:text-left">
                                            <div className="flex items-center gap-3 justify-center md:justify-start">
                                                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                                                    <Globe size={20} />
                                                </div>
                                                <h4 className="text-lg font-bold tracking-tight">Webhook Handshake</h4>
                                            </div>
                                            <p className="text-blue-100 text-xs font-medium">Connect your WhatsApp provider (like 11za) to this secure endpoint.</p>
                                        </div>
                                        <div className="flex items-center gap-4 bg-white/10 p-2 rounded-lg border border-white/20 w-full md:w-auto relative z-10 shadow-inner">
                                            <code className="text-[11px] font-mono font-medium px-4 flex-1 truncate max-w-[300px]">https://aura-chat.com/api/webhook</code>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => { navigator.clipboard.writeText("https://aura-chat.com/api/webhook"); alert("Copied!"); }}
                                                className="h-10 px-6 rounded-md bg-white text-blue-600 font-bold text-[10px] uppercase tracking-wider shadow-sm hover:bg-slate-50 transition-all border-none"
                                            >
                                                Copy
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="bg-white border border-slate-200 p-8 rounded-xl space-y-8 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center">
                                                    <LayoutDashboard size={20} />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-900">Google Sheets</h3>
                                                    <p className="text-slate-400 text-xs">Sync structured data tables.</p>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 p-6 rounded-lg border border-slate-100">
                                                <SaveGoogleSheet phoneNumber={selectedPhoneNumber!} />
                                            </div>
                                            <SyncGoogleSheetButton phoneNumber={selectedPhoneNumber!} />
                                        </div>

                                        <div className="bg-white border border-slate-200 p-8 rounded-xl space-y-8 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                                                    <FileText size={20} />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-900">Google Docs</h3>
                                                    <p className="text-slate-400 text-xs">Sync long-form documents.</p>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 p-6 rounded-lg border border-slate-100">
                                                <SaveGoogleDoc phoneNumber={selectedPhoneNumber!} />
                                            </div>
                                            <SyncGoogleDocButton phoneNumber={selectedPhoneNumber!} />
                                        </div>
                                    </div>

                                    {/* File Upload */}
                                    <div className="bg-white border border-slate-200 p-8 rounded-xl shadow-sm space-y-8">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center">
                                                    <LinkIcon size={20} />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-900">Local Assets</h3>
                                                    <p className="text-slate-400 text-xs">Upload PDFs, text files or images.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                                                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Vision Engine</span>
                                                <Switch checked={devMode} onCheckedChange={setDevMode} className="data-[state=checked]:bg-[#2563eb]" />
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 rounded-lg p-2 border-2 border-dashed border-slate-200 transition-colors hover:border-blue-200">
                                            <FileUpload
                                                onFileSelect={handleFileSelect}
                                                accept=".pdf,image/*"
                                                maxSize={50}
                                                selectedFile={selectedFile}
                                            />
                                        </div>

                                        {devMode && selectedFile && selectedFile.type.startsWith("image/") && (
                                            <div className="bg-slate-50 p-6 rounded-lg border border-slate-100 flex flex-col md:flex-row gap-4">
                                                {[
                                                    { id: "ocr", label: "Optical OCR", desc: "Extract raw text" },
                                                    { id: "transcribe", label: "Semantic Translation", desc: "Interpret context" }
                                                ].map((mode) => (
                                                    <button
                                                        key={mode.id}
                                                        type="button"
                                                        onClick={() => setProcessingMode(mode.id as any)}
                                                        className={`flex-1 p-5 rounded-lg border transition-all text-left ${processingMode === mode.id
                                                                ? "bg-white border-[#2563eb] shadow-sm"
                                                                : "bg-white border-slate-200 hover:border-slate-300"
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="space-y-0.5">
                                                                <h4 className={`text-xs font-bold ${processingMode === mode.id ? "text-[#2563eb]" : "text-slate-900"}`}>{mode.label}</h4>
                                                                <p className="text-[10px] font-medium text-slate-400">{mode.desc}</p>
                                                            </div>
                                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${processingMode === mode.id ? "border-[#2563eb] bg-[#2563eb]" : "border-slate-200"}`}>
                                                                {processingMode === mode.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        <Button
                                            onClick={handleUpload}
                                            disabled={uploading || !selectedFile}
                                            className="w-full py-6 rounded-lg bg-[#2563eb] text-white font-bold text-sm shadow-md shadow-blue-100 hover:translate-y-[-1px] transition-all"
                                        >
                                            {uploading ? <RefreshCcw size={16} className="animate-spin mr-2" /> : <Plus size={16} className="mr-2" />}
                                            {uploading ? "Analyzing..." : "Analyze and Inject Local File"}
                                        </Button>
                                    </div>

                                    {/* Asset Table */}
                                    {selectedGroup && selectedGroup.files.length > 0 && (
                                        <div className="pt-4 animate-in fade-in duration-500">
                                            <div className="flex items-center justify-between mb-4 px-2">
                                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-3">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                                    Bot Knowledge Base
                                                </h3>
                                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase">
                                                    {selectedGroup.files.length} Live Documents
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 gap-3">
                                                {selectedGroup.files.map((file) => (
                                                    <div key={file.id} className="bg-white border border-slate-200 p-5 rounded-xl flex items-center justify-between hover:border-blue-200 transition-all shadow-sm">
                                                        <div className="flex items-center gap-5">
                                                            <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                                                                <FileText size={18} />
                                                            </div>
                                                            <div className="space-y-0.5">
                                                                <h4 className="font-bold text-sm text-slate-900">{file.name}</h4>
                                                                <div className="flex items-center gap-4 text-[10px] font-medium text-slate-400">
                                                                    <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase">{file.file_type}</span>
                                                                    <span className="flex items-center gap-1.5"><Database size={10} /> {file.chunk_count || 0} chunks</span>
                                                                    <div className="w-1 h-1 rounded-full bg-slate-200 mx-1"></div>
                                                                    <span>RAG Ready</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => deleteFile(file.id)}
                                                            className="text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all rounded-lg"
                                                        >
                                                            <Trash2 size={16} />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6 animate-in fade-in duration-500">
                            <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                <Bot size={32} className="text-slate-300" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-slate-900">Bot Console Standby</h3>
                                <p className="text-slate-400 max-w-sm mx-auto font-medium text-sm">
                                    Select a bot configuration from the sidebar or click "Add New Bot" to get started.
                                </p>
                            </div>
                            <Button
                                onClick={handleNewPhone}
                                className="rounded-lg bg-[#2563eb] text-white px-8 py-6 font-bold uppercase tracking-wider text-[10px] shadow-md shadow-blue-100 hover:translate-y-[-1px] transition-all"
                            >
                                Create New AI Profile
                            </Button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}