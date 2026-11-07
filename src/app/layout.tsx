import { PublicTheme } from "@/components/public/PublicTheme";
import "./globals.css";
import type { Metadata } from "next";
import {
  JetBrains_Mono,
  Fredoka,
  Nunito,
  Fraunces,
} from "next/font/google";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";
import { getWhatsAppNumber } from "@/lib/portal-settings";

// Admin/blog (inherited) typography
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-import",
  display: "swap",
});
// Playful kids/public typography
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fun-import",
  display: "swap",
});
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-round-import",
  display: "swap",
});
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-story-import",
  display: "swap",
});

const SITE_URL = "https://ai4kids.tertiarycourses.com.sg";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  icons: { icon: [{ url: "/sunny-icon.svg", type: "image/svg+xml" }, { url: "/favicon.ico", sizes: "48x48" }], apple: "/apple-icon.png" },
  title: {
    default: "AI for Kids Singapore | December School Holiday Workshops",
    template: "%s | AI Kids Academy",
  },
  description:
    "Where kids learn AI by making things — AI storytelling, coding, game design, phonics, escape rooms and free games. Live classes + a gamified learning playground for ages 4–16.",
  keywords:
    "AI for kids, kids coding Singapore, AI storytelling for children, kids game development, AI phonics, coding classes for kids, STEM enrichment Singapore",
  openGraph: {
    type: "website",
    siteName: "AI Kids Academy",
    locale: "en_SG",
    url: SITE_URL,
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const whatsapp = await getWhatsAppNumber().catch(() => null);

  return (
    <html
      lang="en"
      className={`${mono.variable} ${fredoka.variable} ${nunito.variable} ${fraunces.variable}`}
    >
      <body className="min-h-screen antialiased font-round text-slate-800">
        <PublicTheme>{children}</PublicTheme>
        {whatsapp ? <WhatsAppButton number={whatsapp} /> : null}
      </body>
    </html>
  );
}
