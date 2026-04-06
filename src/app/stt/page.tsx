'use client';

import { useState, useRef, useCallback } from 'react';
import { 
  Mic, 
  MicOff, 
  Upload, 
  Download, 
  Loader2, 
  Zap, 
  ChevronLeft, 
  Database, 
  LayoutDashboard, 
  Globe, 
  Settings, 
  Sparkles,
  Volume2,
  Trash2,
  Clipboard,
  FileText
} from 'lucide-react';
import Link from "next/link";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TranscriptionResult {
  rawTranscript: string;
  cleanedTranscript: string;
  language?: string;
  timestamps?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

export default function SpeechToTextPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudioBlob(audioBlob, 'recording.webm');
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setError('Failed to access microphone.');
      console.error(err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const processAudioBlob = async (audioBlob: Blob, filename: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, filename);
      const response = await fetch('/api/stt/mistral', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Transcription failed');
      setTranscription(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setError(null);
    const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/webm', 'audio/mp4', 'audio/x-m4a'];
    if (!allowedTypes.includes(file.type)) { setError('Unsupported file type'); return; }
    if (file.size > 25 * 1024 * 1024) { setError('File too large (Max 25MB)'); return; }
    await processAudioBlob(file, file.name);
  }, []);

  const downloadTranscription = useCallback(() => {
    if (!transcription) return;
    const content = `Raw:\n${transcription.rawTranscript}\n\nCleaned:\n${transcription.cleanedTranscript}\n\nLang: ${transcription.language || 'Unknown'}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aura-stt.txt';
    a.click();
  }, [transcription]);

  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden flex flex-col md:flex-row">
      <div className="fixed top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full z-0 opacity-50" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-secondary/20 blur-[120px] rounded-full z-0 opacity-50" />

      {/* Sidebar */}
      <aside className="w-full md:w-20 glass border-b md:border-b-0 md:border-r border-white/5 flex flex-col items-center py-8 gap-8 z-20">
        <Link href="/" className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center hover:scale-110 transition-transform shadow-[0_0_20px_-5px_var(--color-primary)]">
            <Zap size={24} className="text-white fill-white" />
        </Link>
        <div className="flex flex-row md:flex-col gap-6 font-medium text-muted-foreground">
            <Link href="/files" className="p-3 rounded-xl hover:bg-white/5 transition-colors"><Database size={24} /></Link>
            <Link href="/chat" className="p-3 rounded-xl hover:bg-white/5 transition-colors"><LayoutDashboard size={24} /></Link>
            <Link href="/ocr" className="p-3 rounded-xl hover:bg-white/5 transition-colors"><Globe size={24} /></Link>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 overflow-y-auto z-10 px-6 py-12 md:px-16 md:py-20 flex flex-col items-center">
        <div className="max-w-5xl w-full space-y-12">
            <header className="space-y-4 text-center md:text-left">
                <Link href="/files" className="inline-flex items-center text-sm font-bold text-primary hover:gap-2 transition-all gap-1">
                    <ChevronLeft size={16} /> Back to Hub
                </Link>
                <h1 className="text-5xl font-black tracking-tighter text-gradient flex items-center justify-center md:justify-start gap-4">
                    <Volume2 size={44} className="text-primary" /> AuraSound STT
                </h1>
                <p className="text-muted-foreground text-lg font-medium max-w-2xl mx-auto md:mx-0">Convert multi-lingual audio into structured knowledge with high-precision neural transcription.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Input Panel */}
                <section className="glass rounded-[3rem] p-10 border-white/5 flex flex-col items-center space-y-12">
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-black uppercase tracking-widest text-white/40">Audio Uplink</h3>
                        <p className="text-xs text-muted-foreground font-bold">Stream audio directly to the Mistral Neural Engine.</p>
                    </div>

                    <div className="relative flex items-center justify-center w-full">
                        {isRecording && (
                            <>
                                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-20" />
                                <div className="absolute inset-0 bg-primary/20 scale-150 rounded-full animate-pulse opacity-10" />
                            </>
                        )}
                        <button 
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all shadow-[0_0_50px_-10px_rgba(var(--color-primary),0.5)] ${isRecording ? 'bg-red-500 scale-110 shadow-red-500/40' : 'bg-primary hover:scale-105'}`}
                        >
                            {isRecording ? <MicOff size={40} className="text-white" /> : <Mic size={40} className="text-white" />}
                        </button>
                    </div>

                    <div className="w-full space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="h-px bg-white/10 flex-1" />
                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest whitespace-nowrap">Local Import</span>
                            <div className="h-px bg-white/10 flex-1" />
                        </div>

                        <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                        <Button 
                            onClick={() => fileInputRef.current?.click()} 
                            variant="ghost" 
                            className="w-full py-8 border border-white/5 hover:bg-white/5 rounded-2xl gap-3 flex flex-col h-auto"
                        >
                            <Upload className="text-primary opacity-60" size={24} />
                            <div className="text-center">
                                <p className="font-bold text-sm">{selectedFile ? selectedFile.name : "Inject Audio File"}</p>
                                <p className="text-[10px] uppercase font-black tracking-widest opacity-30 mt-1">WAV, MP3, M4A, WEBM</p>
                            </div>
                        </Button>
                    </div>

                    {isProcessing && (
                        <div className="w-full glass p-6 rounded-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4">
                            <Loader2 className="animate-spin text-primary" size={28} />
                            <div className="flex-1">
                                <p className="text-xs font-black uppercase tracking-widest">Neural Processing</p>
                                <p className="text-[10px] text-muted-foreground italic">Decrypting audio waves...</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
                            <p className="text-[10px] font-bold text-red-300 uppercase tracking-widest">{error}</p>
                        </div>
                    )}
                </section>

                {/* Output Panel */}
                <section className="glass rounded-[3rem] p-10 border-white/5 flex flex-col space-y-8">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Sparkles size={20} className="text-secondary" /> Neural Log
                            </h3>
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Transcription Stream</p>
                        </div>
                        {transcription && (
                            <div className="flex gap-2">
                                <Button size="icon" variant="ghost" className="w-10 h-10 rounded-xl hover:bg-white/5" onClick={() => {navigator.clipboard.writeText(transcription.cleanedTranscript); alert("Copied!");}}>
                                    <Clipboard size={16} />
                                </Button>
                                <Button size="icon" variant="ghost" className="w-10 h-10 rounded-xl hover:bg-white/5" onClick={downloadTranscription}>
                                    <Download size={16} />
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-h-[400px] flex flex-col">
                        {!transcription && !isProcessing && (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-10 space-y-6 opacity-30 border border-dashed border-white/10 rounded-[2rem]">
                                <Volume2 size={60} className="text-muted-foreground animate-pulse" />
                                <div>
                                    <h4 className="font-black uppercase tracking-widest text-xs mb-2">Awaiting Signal</h4>
                                    <p className="text-[10px] max-w-[200px] font-medium leading-relaxed">Initiate recording or upload a source to populate the neural transcription buffer.</p>
                                </div>
                            </div>
                        )}

                        {transcription && (
                            <ScrollArea className="flex-1 space-y-8">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                            <Sparkles size={12} /> Refined Knowledge
                                        </label>
                                        <div className="glass p-6 rounded-2xl text-sm leading-relaxed text-white/80 border-white/5">
                                            {transcription.cleanedTranscript}
                                        </div>
                                    </div>

                                    <div className="space-y-2 opacity-50">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            <FileText size={12} /> Raw Signal
                                        </label>
                                        <div className="bg-black/20 p-4 rounded-xl text-[11px] font-mono whitespace-pre-wrap">
                                            {transcription.rawTranscript}
                                        </div>
                                    </div>

                                    {transcription.timestamps && transcription.timestamps.length > 0 && (
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                                <Settings size={12} /> Chronological Segments
                                            </label>
                                            <div className="space-y-2">
                                                {transcription.timestamps.map((segment, i) => (
                                                    <div key={i} className="flex gap-4 group">
                                                        <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-1">[{formatTimestamp(segment.start)}]</span>
                                                        <p className="text-xs font-medium text-white/60 group-hover:text-white transition-colors">{segment.text}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        )}
                    </div>

                    {transcription && (
                        <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                            <div className="flex gap-4">
                                <div className="text-center">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase">Words</p>
                                    <p className="text-lg font-black">{transcription.cleanedTranscript.split(' ').length}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase">Lang</p>
                                    <p className="text-lg font-black">{transcription.language || '??'}</p>
                                </div>
                            </div>
                            <Button variant="ghost" onClick={() => setTranscription(null)} className="h-12 w-12 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10">
                                <Trash2 size={18} />
                            </Button>
                        </div>
                    )}
                </section>
            </div>
        </div>
      </main>
    </div>
  );
}