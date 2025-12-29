import type { Metadata } from "next";
import { Montserrat, Open_Sans } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "./context/LanguageContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";

// Primary font - Montserrat (used by CMC website for headings)
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// Secondary font - Open Sans (used by CMC website for body text)
const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CincyMuse - Your Digital Guide | Cincinnati Museum Center",
  description: "CincyMuse is your digital guide to the Cincinnati Museum Center. Get information about exhibits, plan your visit, buy tickets, and explore collections.",
  keywords: ["Cincinnati Museum Center", "museum", "exhibits", "tickets", "Cincinnati", "CincyMuse"],
  authors: [{ name: "Cincinnati Museum Center" }],
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
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
      <body className={`${montserrat.variable} ${openSans.variable} antialiased`} suppressHydrationWarning>
        <AdminAuthProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </AdminAuthProvider>
      </body>
    </html>
  );
}
