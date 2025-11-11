// app/layout.tsx
import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import AuthGuard from "@/lib/auth-guard";

// Load Inter font
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Carma",
  description:
    "CODE SIMILARITY DETECTION, AI-GENERATED CODE IDENTIFICATION, REAL-TIME STUDENT ACTIVITY MONITORING FOR ACADEMIC INTEGRITY",

};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
            <head>
        <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192-v3.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/favicon-512-v3.png" />
        <link rel="icon" type="image/svg+xml" href="/favicon-v3.svg" />
        <link rel="shortcut icon" href="/favicon-v3.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"/>
        <meta name="theme-color" content="#ffffff" />
      </head>
<body className={`${inter.variable} ${geistMono.variable} antialiased`}>
  <AuthGuard>
        {children}
        <Toaster />
        </AuthGuard>
      </body>
      
    </html>
  );
}


    