import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ModeProvider } from "./context/ModeContext";

export const metadata: Metadata = {
  title: "Arcane Sovereign Engine",
  description: "Offline-ready PDF and document processing platform.",
  keywords: ["PDF", "image processing", "offline", "document tools"],
  authors: [{ name: "Arcane Sovereign" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#050412" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen">
        <ModeProvider>
          {children}
        </ModeProvider>
      </body>
    </html>
  );
}