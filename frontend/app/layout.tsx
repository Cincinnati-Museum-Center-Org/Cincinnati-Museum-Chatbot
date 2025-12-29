import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "./context/LanguageContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CincyMuse - Your Digital Guide | Cincinnati Museum Center",
  description: "CincyMuse is your digital guide to the Cincinnati Museum Center. Get information about exhibits, plan your visit, buy tickets, and explore collections.",
  keywords: ["Cincinnati Museum Center", "museum", "exhibits", "tickets", "Cincinnati", "CincyMuse"],
  authors: [{ name: "Cincinnati Museum Center" }],
  openGraph: {
    title: "CincyMuse - Your Digital Guide",
    description: "Your digital guide to the Cincinnati Museum Center",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
