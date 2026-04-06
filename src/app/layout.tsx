import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import type { Metadata } from "next";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AuraChat | Ultimate WhatsApp RAG",
  description: "Next-gen AI automation for WhatsApp",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-[#f8fafc] text-[#0f172a] min-h-screen relative overflow-x-hidden`}
      >
        <div className="fixed inset-0 bg-grid z-[-1] opacity-5 pointer-events-none" />
        {children}
      </body>
    </html>
  );
}
