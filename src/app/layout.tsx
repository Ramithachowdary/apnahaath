import { SITE_URL } from "@/lib/site";
import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

// Google Fonts via next/font (self-hosted at build time, no runtime request to Google):
// Noto Sans for Latin text and Noto Sans Devanagari for Hindi words like "दवाई".
const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "600", "700"],
  variable: "--font-deva",
  display: "swap",
  preload: false,
});

const DESCRIPTION =
  "A shared medicine log for an elder, her caretaker and her family. Only the elder marks a dose as taken; AI can warn but never change a prescription.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "ApnaHaath — Dawai unke haath se", template: "%s · ApnaHaath" },
  description: DESCRIPTION,
  applicationName: "ApnaHaath",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "ApnaHaath",
    title: "ApnaHaath — Medicine from her hand. The log in her name.",
    description: DESCRIPTION,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "ApnaHaath — Medicine from her hand. The log in her name.",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#0f5c4c", width: "device-width", initialScale: 1 };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${notoSans.variable} ${notoDevanagari.variable} antialiased`}>{children}</body>
    </html>
  );
}
