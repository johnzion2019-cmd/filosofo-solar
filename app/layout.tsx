import type { Metadata } from "next";
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
  robots: { index: false, follow: false },
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
