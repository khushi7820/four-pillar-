import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  MessageSquare, 
  Database, 
  RefreshCcw, 
  Smartphone, 
  ArrowRight,
  Sparkles,
  Zap
} from "lucide-react";

export default function HomePage() {
    return (
        <main className="relative flex flex-col items-center justify-center min-h-screen px-6 py-20 overflow-hidden">
            {/* Header / Nav */}
            <nav className="fixed top-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 glass rounded-full z-50">
                <div className="flex items-center gap-2 pr-4 border-r border-white/10">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                        <Zap size={18} className="text-white fill-white" />
                    </div>
                    <span className="font-bold text-lg tracking-tight">AuraChat</span>
                </div>
                <Link href="/chat" className="text-sm font-medium hover:text-primary transition-colors">Chat</Link>
                <Link href="/files" className="text-sm font-medium hover:text-primary transition-colors">Docs</Link>
                <Link href="/files" className="text-sm font-medium hover:text-primary transition-colors">Numbers</Link>
            </nav>

            {/* Hero Section */}
            <div className="max-w-4xl w-full text-center space-y-8 mb-20 pt-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary animate-bounce text-sm font-medium">
                    <Sparkles size={14} />
                    The Future of WhatsApp RAG
                </div>
                
                <h1 className="text-6xl md:text-8xl font-black text-gradient leading-tight tracking-tighter">
                    Elevate Your <br /> WhatsApp Game.
                </h1>
                
                <p className="text-xl md:text-2xl text-muted-foreground/80 max-w-2xl mx-auto font-medium">
                    Deploy hyper-intelligent, data-driven AI bots that respond like humans. No generic chat, just pure intent.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                    <Link href="/chat">
                        <Button size="lg" className="rounded-full px-8 py-7 text-lg bg-primary hover:bg-primary/90 neon-glow transition-all active:scale-95 group">
                            Get Started
                            <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </Link>
                    <Link href="/files">
                        <Button size="lg" variant="outline" className="rounded-full px-8 py-7 text-lg border-white/10 glass hover:bg-white/5 bg-transparent transition-all">
                            Training Center
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl w-full">
                <FeatureCard
                    icon={<Smartphone className="text-primary" />}
                    title="Phone Numbers"
                    desc="Manage multiple WhatsApp nodes effortlessly."
                    href="/files"
                />
                <FeatureCard
                    icon={<Database className="text-secondary" />}
                    title="Knowledge Base"
                    desc="Inject PDFs & Docs directly into AI memory."
                    href="/files"
                />
                <FeatureCard
                    icon={<RefreshCcw className="text-accent" />}
                    title="Sync Lab"
                    desc="Zero-latency Google Sheet data streaming."
                    href="/files"
                />
                <FeatureCard
                    icon={<MessageSquare className="text-primary" />}
                    title="Live Monitor"
                    desc="Watch your AI agents interact in real-time."
                    href="/chat"
                />
            </div>

            {/* Status Footer */}
            <footer className="mt-24 px-8 py-4 glass rounded-2xl flex items-center gap-4 text-sm font-medium text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                System Status: All Engines Operational
                <span className="opacity-30">|</span>
                <span>NextGen Automation © 2026</span>
            </footer>
        </main>
    );
}

function FeatureCard({ icon, title, desc, href }: { icon: React.ReactNode, title: string, desc: string, href: string }) {
    return (
        <Link href={href} className="group">
            <Card className="h-full glass border-white/5 bg-white/[0.02] hover:bg-white/[0.08] transition-all transform hover:-translate-y-2 hover:shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-3xl -mr-8 -mt-8 group-hover:bg-primary/20 transition-all" />
                <CardContent className="p-8 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-black/40 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                        {icon}
                    </div>
                    <div>
                        <h3 className="text-xl font-bold tracking-tight mb-2">{title}</h3>
                        <p className="text-muted-foreground leading-relaxed transition-colors group-hover:text-foreground">
                            {desc}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
