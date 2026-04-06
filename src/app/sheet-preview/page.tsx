"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  ArrowLeft, 
  Table as TableIcon, 
  Database, 
  RefreshCcw, 
  Search, 
  Zap, 
  ShieldCheck,
  Download,
  Filter
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type SheetRow = Record<string, any>;

function SheetPreviewContent() {
  const searchParams = useSearchParams();
  const phone_number = searchParams.get("phone_number");

  const [rows, setRows] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSheetPreview = useCallback(async () => {
    if (!phone_number) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/sheet-preview?phone_number=${encodeURIComponent(phone_number)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch sheet data");
      setRows(data.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [phone_number]);

  useEffect(() => {
    fetchSheetPreview();
  }, [fetchSheetPreview]);

  if (!phone_number) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="glass p-12 rounded-[3.5rem] text-center max-w-md space-y-6 animate-in zoom-in-95">
          <div className="w-24 h-24 bg-red-400/10 rounded-full flex items-center justify-center mx-auto shadow-[0_0_40px_-10px_rgba(248,113,113,0.3)]">
            <ShieldCheck className="text-red-400" size={48} />
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic">Signal Void</h1>
          <p className="text-muted-foreground font-medium text-sm leading-relaxed">No target node identified in the uplink. The data stream cannot be resolved.</p>
          <Link href="/files" className="block pt-4">
            <Button className="w-full bg-primary hover:bg-primary/90 text-white rounded-3xl py-7 font-black uppercase tracking-widest text-xs">Return to Hub</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden flex flex-col">
      {/* Dynamic Background */}
      <div className="fixed top-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[140px] rounded-full z-0 opacity-40" />
      <div className="fixed bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-secondary/10 blur-[140px] rounded-full z-0 opacity-40" />
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none z-[1]" />

      <main className="flex-1 z-10 px-6 py-8 md:px-16 md:py-16 flex flex-col max-w-[1600px] mx-auto w-full">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12 shrink-0">
          <div className="space-y-6">
            <Link href="/files" className="inline-flex items-center text-xs font-black uppercase tracking-[0.2em] text-primary hover:gap-3 transition-all gap-2 group">
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Matrix Hub
            </Link>
            <div className="space-y-2">
              <h1 className="text-6xl font-black tracking-tighter text-gradient flex items-center gap-5">
                <TableIcon size={52} className="text-primary" /> Data Terminal
              </h1>
              <div className="flex items-center gap-3">
                 <span className="text-[10px] font-black uppercase tracking-widest bg-white/5 border border-white/10 px-3 py-1 rounded-full text-muted-foreground">Active Node</span>
                 <p className="text-primary font-bold text-lg">{phone_number}</p>
                 {rows.length > 0 && <span className="text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">{rows.length} RECORDED ENTRIES</span>}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
             <Button variant="ghost" className="rounded-2xl border border-white/5 hover:bg-white/5 gap-2 h-14 px-6 text-xs font-black uppercase tracking-[0.1em]" onClick={fetchSheetPreview}>
                <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} /> Resync Grid
             </Button>
             <Button variant="ghost" className="rounded-2xl border border-white/5 hover:bg-white/5 h-14 w-14 p-0">
                <Download size={18} />
             </Button>
          </div>
        </header>

        <section className="flex-1 min-h-0">
          <div className="glass rounded-[3.5rem] border-white/5 h-full flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
             {/* Terminal Header */}
             <div className="px-10 py-6 border-b border-white/5 bg-white/[0.01] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-muted-foreground">
                    <Database size={18} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Neural Spreadsheet Interface</span>
                </div>
                <div className="flex gap-4">
                   <div className="relative">
                      <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                      <input type="text" placeholder="QUERY RECORDS..." className="bg-black/40 border border-white/10 rounded-xl px-10 py-2.5 text-[10px] font-black tracking-widest focus:outline-none focus:border-primary/40 w-full md:w-64 placeholder:opacity-40" />
                   </div>
                   <Button variant="ghost" className="rounded-xl border border-white/5 bg-white/5 w-10 h-10 p-0 text-muted-foreground">
                      <Filter size={14} />
                   </Button>
                </div>
             </div>

             <div className="flex-1 overflow-auto custom-scrollbar p-6">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-8 animate-pulse">
                        <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                        <div className="space-y-2 text-center">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Establishing Link</p>
                            <p className="text-[10px] font-mono text-muted-foreground italic">RETRIEVING GOOGLE SHEETS DATA BUFFERS...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-8 text-center p-12">
                        <div className="w-20 h-20 rounded-3xl bg-red-400/10 flex items-center justify-center shadow-lg shadow-red-500/20">
                            <ShieldCheck className="text-red-400" size={32} />
                        </div>
                        <div className="space-y-2 max-w-sm">
                            <h3 className="text-2xl font-black italic uppercase text-red-100">Uplink Failure</h3>
                            <p className="text-sm font-medium text-white/40 leading-relaxed">{error}</p>
                        </div>
                    </div>
                ) : rows.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-8 opacity-40 text-center">
                        <Database size={80} className="text-muted-foreground animate-bounce" />
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <p className="text-sm font-black uppercase tracking-[0.2em]">Record Ledger Empty</p>
                                <p className="text-[10px] max-w-[250px] font-medium opacity-60">The requested node contains no valid data rows in its associated sheet.</p>
                            </div>
                            <Link href="/files">
                                <Button variant="outline" className="rounded-xl border-white/10 hover:bg-white/5 text-xs h-10 px-8">Return to Control</Button>
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="relative">
                        <table className="w-full text-left border-separate border-spacing-y-2.5">
                            <thead>
                                <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                                    {Object.keys(rows[0] || {}).map((key) => (
                                        <th key={key} className="px-6 py-4 font-black">{key}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, index) => (
                                    <tr key={index} className="group transition-all">
                                        {Object.values(row).map((value: any, cellIndex) => (
                                            <td key={cellIndex} className="bg-white/[0.02] group-hover:bg-primary/[0.08] transition-colors border-y border-white/5 first:border-l first:rounded-l-[1.5rem] last:border-r last:rounded-r-[1.5rem] border-transparent px-6 py-5">
                                                <div className="text-[13px] font-bold text-white/70 group-hover:text-white transition-colors">
                                                    {value?.toString() || "-"}
                                                </div>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
             </div>

             {/* Footer Statistics */}
             {rows.length > 0 && !loading && (
                 <div className="px-10 py-6 border-t border-white/5 bg-white/[0.01] flex items-center justify-between text-muted-foreground">
                    <div className="flex gap-8">
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Columns</span>
                           <span className="text-xs font-black text-primary">{Object.keys(rows[0]).length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Rows</span>
                           <span className="text-xs font-black text-secondary">{rows.length}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Zap size={14} className="text-green-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-green-400">Stream Verified</span>
                    </div>
                 </div>
             )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function SheetPreviewPage() {
  return (
    <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
            <RefreshCcw className="animate-spin text-primary" size={40} />
        </div>
    }>
      <SheetPreviewContent />
    </Suspense>
  );
}