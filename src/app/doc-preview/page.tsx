"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  ArrowLeft, 
  FileText, 
  Database, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  RefreshCcw,
  Clock,
  Link as LinkIcon
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type DocChunk = {
  content: string;
};

function DocPreviewContent() {
  const searchParams = useSearchParams();
  const phone_number = searchParams.get("phone_number");

  const [chunks, setChunks] = useState<DocChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [docName, setDocName] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const fetchDocPreview = useCallback(async () => {
    if (!phone_number) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/doc-preview?phone_number=${encodeURIComponent(phone_number)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch doc data");

      setChunks(data.chunks || []);
      setConnected(data.connected || false);
      setDocId(data.docId || null);
      setDocName(data.docName || null);
      setLastSyncedAt(data.last_synced_at || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [phone_number]);

  useEffect(() => {
    fetchDocPreview();
  }, [fetchDocPreview]);

  if (!phone_number) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="glass p-12 rounded-[3rem] text-center max-w-md space-y-6">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
            <ShieldCheck className="text-red-500" size={40} />
          </div>
          <h1 className="text-2xl font-black italic">ACCESS DENIED</h1>
          <p className="text-muted-foreground font-medium text-sm">No node identifier provided in the stream. Signal lost.</p>
          <Link href="/files" className="block">
            <Button className="w-full bg-primary hover:bg-primary/90 text-white rounded-2xl py-6">Reconnect to Hub</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden flex flex-col md:flex-row">
      {/* Decorative Elements */}
      <div className="fixed top-[-5%] left-[-5%] w-[30%] h-[30%] bg-primary/20 blur-[100px] rounded-full z-0 pointer-events-none" />
      <div className="fixed bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-secondary/10 blur-[100px] rounded-full z-0 pointer-events-none" />

      {/* Main Content */}
      <main className="flex-1 z-10 px-6 py-12 md:px-16 md:py-20 flex flex-col">
          <div className="max-w-6xl mx-auto w-full space-y-12 flex-1 flex flex-col">
              <header className="space-y-6 shrink-0">
                  <div className="flex items-center justify-between">
                    <Link href="/files" className="inline-flex items-center text-sm font-bold text-primary hover:gap-2 transition-all gap-1 group">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Intelligence Hub
                    </Link>
                    <Button variant="ghost" className="rounded-xl border border-white/5 hover:bg-white/5 gap-2 h-10" onClick={fetchDocPreview}>
                        <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Stream
                    </Button>
                  </div>
                  
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <h1 className="text-5xl font-black tracking-tighter text-gradient flex items-center gap-4">
                            <FileText size={44} className="text-primary" /> Doc Intelligence
                        </h1>
                        <p className="text-muted-foreground font-medium text-lg">Inspecting neural chunks for target node <span className="text-primary font-bold">{phone_number}</span></p>
                    </div>
                  </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 flex-1">
                {/* Meta Panel */}
                <aside className="space-y-6">
                    <div className="glass rounded-[2.5rem] p-8 border-white/5 space-y-8 animate-in slide-in-from-left-8">
                        <div className="space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-widest text-white/40 border-b border-white/5 pb-4">Connection Specs</h3>
                            <div className="space-y-5">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                                        {connected ? <Zap className="text-green-400" size={18} /> : <ShieldCheck className="text-red-400" size={18} />}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-muted-foreground">Pulse Status</p>
                                        <p className={`text-sm font-bold ${connected ? 'text-green-400' : 'text-red-400'}`}>{connected ? 'ACTIVE UPLINK' : 'DISCONNECTED'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 opacity-80">
                                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                                        <LinkIcon className="text-primary" size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-muted-foreground">Knowledge ID</p>
                                        <p className="text-xs font-mono break-all font-bold">{docId || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 opacity-80">
                                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                                        <Clock className="text-secondary" size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-muted-foreground">Last Sync</p>
                                        <p className="text-xs font-bold">{lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'NEVER SYNCED'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-primary/5 border border-primary/20 rounded-2xl">
                           <div className="flex items-center gap-2 mb-2 text-primary font-black uppercase text-[10px] tracking-widest">
                             <Sparkles size={12} /> Intelligence Summary
                           </div>
                           <p className="text-xs text-white/60 leading-relaxed font-medium capitalize prose">
                                {docName ? `Analyzing metadata for dataset "${docName}". Source integrity verified via Google Cloud Engine.` : 'Source document metadata is not yet initialized for this node cluster.'}
                           </p>
                        </div>
                    </div>
                </aside>

                {/* Chunks Panel */}
                <section className="lg:col-span-2 flex flex-col min-h-0">
                    <div className="glass rounded-[3rem] border-white/5 h-full flex flex-col overflow-hidden animate-in fade-in transition-all">
                        <div className="p-10 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                            <h3 className="text-xl font-bold flex items-center gap-3">
                                <Database size={20} className="text-primary" /> Memory Shards
                                <span className="text-[10px] font-black py-1 px-3 bg-primary/20 text-primary rounded-full">{chunks.length} UNITS</span>
                            </h3>
                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                           {loading ? (
                               <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-30 text-center">
                                   <RefreshCcw className="animate-spin text-primary" size={48} />
                                   <div className="space-y-1">
                                       <p className="text-xs font-black uppercase tracking-[0.2em]">Decrypting Ledger</p>
                                       <p className="text-[10px] font-mono italic">ACCESSING GOOGLE DRIVE API...</p>
                                   </div>
                               </div>
                           ) : error ? (
                               <div className="h-full flex flex-col items-center justify-center space-y-6 text-center">
                                   <div className="w-16 h-16 rounded-3xl bg-red-500/10 flex items-center justify-center">
                                       <ShieldCheck className="text-red-500" />
                                   </div>
                                   <div className="max-w-xs space-y-2">
                                       <h4 className="text-lg font-black uppercase italic text-red-400">Error Occurred</h4>
                                       <p className="text-xs text-white/60 font-medium leading-relaxed">{error}</p>
                                   </div>
                               </div>
                           ) : chunks.length === 0 ? (
                               <div className="h-full flex flex-col items-center justify-center space-y-8 opacity-30 text-center">
                                   <FileText size={64} className="text-muted-foreground" />
                                   <div className="space-y-4">
                                       <div className="space-y-1">
                                          <p className="text-xs font-black uppercase tracking-widest italic">Node Empty</p>
                                          <p className="text-[10px] font-medium max-w-[200px]">No intelligence shards found. Sync the Google Doc from the Hub to inject memory.</p>
                                       </div>
                                       <Link href="/files" className="inline-block">
                                           <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/5 rounded-xl h-10 px-6">Return to Hub</Button>
                                       </Link>
                                   </div>
                               </div>
                           ) : (
                               <div className="space-y-8">
                                   {chunks.map((chunk, index) => (
                                       <div key={index} className="group relative">
                                          <div className="absolute -left-6 top-6 bottom-0 w-1 bg-white/5 rounded-full group-hover:bg-primary/20 transition-colors" />
                                          <div className="space-y-4 animate-in slide-in-from-bottom-4" style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}>
                                              <div className="flex items-center gap-4">
                                                 <span className="text-[10px] font-black font-mono py-1 px-3 rounded-lg bg-white/5 text-muted-foreground uppercase opacity-60">Shard {index + 1}</span>
                                                 <div className="h-px bg-white/5 flex-1" />
                                              </div>
                                              <div className="glass p-8 rounded-[2rem] border-white/5 text-sm leading-relaxed text-white/70 font-medium hover:text-white transition-colors hover:border-primary/20 hover:bg-white/[0.03]">
                                                  {chunk.content}
                                              </div>
                                          </div>
                                       </div>
                                   ))}
                               </div>
                           )}
                        </div>
                    </div>
                </section>
              </div>
          </div>
      </main>
    </div>
  );
}

export default function DocPreviewPage() {
  return (
    <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
            <RefreshCcw className="animate-spin text-primary" size={32} />
        </div>
    }>
      <DocPreviewContent />
    </Suspense>
  );
}