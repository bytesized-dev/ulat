import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { locale, product, theme } from "@/config";
import "./globals.css";

// next/font downloads both families at build time and serves them from
// /_next/static/media, so nothing reaches Google at runtime.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  weight: "500",
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: {
    default: product.name,
    template: `%s | ${product.name}`,
  },
  description: product.oneLine,
};

export const viewport: Viewport = {
  themeColor: theme.light,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={locale.lang} className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-dvh bg-canvas text-ink">{children}</body>
    </html>
  );
}
