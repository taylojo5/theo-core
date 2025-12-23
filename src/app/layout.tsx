import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider, ErrorProvider } from "@/components/providers";
import { Toaster } from "@/components/ui";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Theo - Your Context-Aware Assistant",
  description:
    "A personal AI assistant that learns and grows with you, understanding your world to help you take the next right step.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          <ErrorProvider>{children}</ErrorProvider>
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
