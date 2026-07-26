import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "NotebookLM-Klon",
  description: "RAG-basierte Wissensbasis mit Zitaten, Zusammenfassung und Chat.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${inter.variable} h-full antialiased`} style={{ colorScheme: "dark" }}>
      <body className="flex h-screen flex-col overflow-y-auto">{children}</body>
    </html>
  );
}
