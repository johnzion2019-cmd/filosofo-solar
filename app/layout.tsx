import type { Metadata, Viewport } from "next";
import { Geist_Mono, Outfit } from "next/font/google";
import { PlantProvider } from "@/components/plant-context";
import { AppShell } from "@/components/shell";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Filosofo Solar", template: "%s · Filosofo Solar" },
  description: "Self-hosted solar dashboard for the Filosofo plant in Negros Oriental.",
  applicationName: "Filosofo Solar",
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Filosofo Solar",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1120",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${geistMono.variable} antialiased`}>
        <PlantProvider>
          <AppShell>{children}</AppShell>
        </PlantProvider>
      </body>
    </html>
  );
}
