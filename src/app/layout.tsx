import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { locale, product, theme } from "@/config";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: product.name,
    template: `%s | ${product.name}`,
  },
  description: product.oneLine,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: theme.light },
    { media: "(prefers-color-scheme: dark)", color: theme.dark },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={locale.lang} className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh bg-page text-text">{children}</body>
    </html>
  );
}
