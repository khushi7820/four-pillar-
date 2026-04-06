"use client";

import { ChangeEvent, useState } from "react";
import { 
  Scan, 
  Upload, 
  Trash2, 
  Database, 
  Globe, 
  Key, 
  Sparkles, 
  FileText, 
  Download, 
  Clipboard, 
  RefreshCcw,
  Zap,
  LayoutDashboard,
  ShieldCheck,
  ChevronLeft,
  Code
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type OCRResult = {
    text: string;
    imageBase64?: string;
    rawResponse?: any;
    debugInfo?: any;
    stored?: boolean;
    file_id?: string | null;
    chunks?: number;
    phone_numbers_mapped?: number;
};

export default function OCRPage() {
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [result, setResult] = useState<OCRResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [shouldStore, setShouldStore] = useState(false);
    const [phoneNumbers, setPhoneNumbers] = useState("");
    const [authToken, setAuthToken] = useState("");
    const [origin, setOrigin] = useState("");

    function handleImageSelect(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedImage(file);
            setError(null);
            setResult(null);

            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    }

    async function handleOCRProcess() {
        if (!selectedImage) {
            setError("Please select an image first");
            return;
        }

        if (shouldStore && (!authToken.trim() || !origin.trim())) {
            setError("11za credentials required for storage");
            return;
        }

        setProcessing(true);
        setError(null);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append("image", selectedImage);
            formData.append("store", shouldStore ? "true" : "false");

            if (shouldStore) {
                formData.append("auth_token", authToken.trim());
                formData.append("origin", origin.trim());
                if (phoneNumbers.trim()) {
                    formData.append("phone_numbers", phoneNumbers.trim());
                }
            }

            const res = await fetch("/api/ocr", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to process image");

            setResult(data);
            if (data.stored && data.chunks > 0) {
                alert(`Success! Saved ${data.chunks} chunks.`);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setProcessing(false);
        }
    }

    function resetForm() {
        setSelectedImage(null);
        setImagePreview(null);
        setResult(null);
        setError(null);
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = "";
    }

    return (
        <div className="min-h-screen bg-background text-foreground relative overflow-hidden flex flex-col md:flex-row">
            {/* Background decorative elements */}
            <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full z-0 opacity-50" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/20 blur-[120px] rounded-full z-0 opacity-50" />
            
            {/* Sidebar for context */}
            <aside className="w-full md:w-20 glass border-b md:border-b-0 md:border-r border-white/5 flex flex-col items-center py-8 gap-8 z-20">
                <Link href="/" className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center hover:scale-110 transition-transform shadow-[0_0_20px_-5px_var(--color-primary)]">
                    <Zap size={24} className="text-white fill-white" />
                </Link>
                <div className="flex flex-row md:flex-col gap-6">
                    <Link href="/files" title="Node Hub" className="p-3 rounded-xl hover:bg-white/5 text-muted-foreground transition-colors">
                        <Database size={24} />
                    </Link>
                    <Link href="/chat" title="AI Console" className="p-3 rounded-xl hover:bg-white/5 text-muted-foreground transition-colors">
                        <LayoutDashboard size={24} />
                    </Link>
                    <Link href="/stt" title="Audio Lab" className="p-3 rounded-xl hover:bg-white/5 text-muted-foreground transition-colors">
                        <Globe size={24} />
                    </Link>
                </div>
            </aside>

            {/* Main Area */}
            <main className="flex-1 overflow-y-auto z-10 px-6 py-12 md:px-16 md:py-20">
                <div className="max-w-5xl mx-auto space-y-12">
                    <header className="space-y-4">
                        <Link href="/files" className="flex items-center text-sm font-bold text-primary hover:gap-2 transition-all gap-1">
                            <ChevronLeft size={16} /> Back to Hub
                        </Link>
                        <h1 className="text-5xl font-black tracking-tighter text-gradient flex items-center gap-4">
                            <Scan size={44} className="text-primary" /> AuraVision OCR
                        </h1>
                        <p className="text-muted-foreground text-lg font-medium max-w-2xl">Mistral-powered visual intelligence. Extract structured data from any image with cryptographic precision.</p>
                    </header>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                        {/* Upload Panel */}
                        <section className="space-y-8">
                            <div className="glass rounded-[2.5rem] p-8 border-white/5 space-y-8">
                                <div className="space-y-2">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <Upload size={20} className="text-primary" /> Raw Source Injection
                                    </h3>
                                    <p className="text-xs text-muted-foreground">Upload images for high-fidelity OCR processing.</p>
                                </div>

                                <div className="relative group">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageSelect}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className={`border-2 border-dashed rounded-[2rem] p-10 flex flex-col items-center justify-center transition-all ${selectedImage ? 'border-primary/40 bg-primary/5' : 'border-white/10 hover:border-primary/20'}`}>
                                        <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <Upload className="text-muted-foreground" />
                                        </div>
                                        <p className="font-bold text-sm">{selectedImage ? selectedImage.name : "Drop visual data or click to browse"}</p>
                                        <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mt-2 opacity-50">PNG, JPG, WEBP (Max 10MB)</p>
                                    </div>
                                </div>

                                {imagePreview && (
                                    <div className="glass rounded-2xl overflow-hidden border-white/10 animate-in zoom-in-95">
                                        <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover opacity-80" />
                                        <div className="p-3 bg-black/40 text-[10px] font-mono text-center">SOURCE PREVIEW ACQUIRED</div>
                                    </div>
                                )}

                                <div className="space-y-4 border-t border-white/5 pt-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Database size={16} className="text-secondary" />
                                            <span className="text-sm font-bold">Inject to Ledger</span>
                                        </div>
                                        <button 
                                            onClick={() => setShouldStore(!shouldStore)}
                                            className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${shouldStore ? 'bg-primary' : 'bg-white/10'}`}
                                        >
                                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${shouldStore ? 'translate-x-6' : ''}`} />
                                        </button>
                                    </div>

                                    {shouldStore && (
                                        <div className="space-y-4 animate-in slide-in-from-top-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">11za Cipher Key</label>
                                                <div className="relative">
                                                    <Key size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                                    <input type="password" value={authToken} onChange={e=>setAuthToken(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-10 py-3 text-sm focus:outline-none focus:border-primary" />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Edge Origin</label>
                                                <div className="relative">
                                                    <Globe size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                                    <input type="text" value={origin} onChange={e=>setOrigin(e.target.value)} placeholder="https://..." className="w-full bg-black/40 border border-white/10 rounded-xl px-10 py-3 text-sm focus:outline-none focus:border-primary" />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Node Mappings (CSV)</label>
                                                <div className="relative">
                                                    <Smartphone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                                    <input type="text" value={phoneNumbers} onChange={e=>setPhoneNumbers(e.target.value)} placeholder="1555000..." className="w-full bg-black/40 border border-white/10 rounded-xl px-10 py-3 text-sm focus:outline-none focus:border-primary" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <Button onClick={handleOCRProcess} disabled={processing || !selectedImage} className="flex-1 py-7 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest neon-glow">
                                        {processing ? <RefreshCcw className="animate-spin mr-2" /> : <Sparkles size={18} className="mr-2" />}
                                        {processing ? "Extracting..." : "Run Extraction"}
                                    </Button>
                                    {(selectedImage || result) && (
                                        <Button onClick={resetForm} variant="ghost" className="p-7 rounded-2xl border border-white/5 text-muted-foreground hover:bg-white/5">
                                            <Trash2 size={20} />
                                        </Button>
                                    )}
                                </div>

                                {error && (
                                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 animate-in shake">
                                        <ShieldCheck className="text-red-400 mt-1 shrink-0" size={18} />
                                        <p className="text-xs text-red-300 font-medium">{error}</p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Result Panel */}
                        <section className="space-y-8">
                            <div className="glass rounded-[2.5rem] h-full p-8 border-white/5 flex flex-col">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-bold flex items-center gap-2">
                                            <Code size={20} className="text-secondary" /> Knowledge Ledger
                                        </h3>
                                        <p className="text-xs text-muted-foreground">Digitalized output buffer.</p>
                                    </div>
                                    {result && (
                                        <div className="flex gap-2">
                                            <Button size="icon" variant="ghost" className="w-10 h-10 rounded-xl bg-white/5" onClick={() => {navigator.clipboard.writeText(result.text); alert("Copied!");}}>
                                                <Clipboard size={16} />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="w-10 h-10 rounded-xl bg-white/5" onClick={() => {
                                                const blob = new Blob([result.text], { type: 'text/plain' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `aura-ocr-${Date.now()}.txt`;
                                                a.click();
                                            }}>
                                                <Download size={16} />
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 min-h-[300px] bg-black/40 rounded-[1.5rem] border border-white/10 p-6 relative group overflow-hidden">
                                    {!result && !processing && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 space-y-4 opacity-40">
                                            <Scan size={48} className="text-muted-foreground" />
                                            <p className="text-sm font-medium">Waiting for data injection...<br/>Run extraction to populate terminal.</p>
                                        </div>
                                    )}

                                    {processing && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 space-y-4">
                                            <div className="w-16 h-16 rounded-full border-2 border-t-primary border-transparent animate-spin" />
                                            <p className="text-sm font-black uppercase tracking-widest text-primary animate-pulse">Processing Buffer...</p>
                                        </div>
                                    )}

                                    {result && (
                                        <ScrollArea className="h-full">
                                            <pre className="text-xs font-mono text-white/70 leading-relaxed whitespace-pre-wrap">
                                                {result.text}
                                            </pre>
                                        </ScrollArea>
                                    )}
                                </div>

                                {result && (
                                    <div className="mt-8 grid grid-cols-3 gap-4">
                                        <div className="glass p-4 rounded-2xl border-white/5 text-center">
                                            <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Bytes</p>
                                            <p className="text-lg font-black">{result.text.length}</p>
                                        </div>
                                        <div className="glass p-4 rounded-2xl border-white/5 text-center">
                                            <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Words</p>
                                            <p className="text-lg font-black">{result.text.split(/\s+/).length}</p>
                                        </div>
                                        <div className="glass p-4 rounded-2xl border-white/5 text-center">
                                            <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Chunks</p>
                                            <p className="text-lg font-black">{result.chunks || 0}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}

// Minimal ScrollArea if not provided by shadcn
function ScrollArea({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={`overflow-y-auto ${className}`}>{children}</div>;
}

function Smartphone({ size, className }: { size?: number, className?: string }) {
    return <SmartphoneIcon size={size} className={className} />;
}

import { Smartphone as SmartphoneIcon } from "lucide-react";
