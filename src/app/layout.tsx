import { SITE_URL } from "@/lib/site";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
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
      <body className={`${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
