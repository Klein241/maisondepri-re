import type { Metadata, Viewport } from "next";
import { Inter, Crimson_Pro } from "next/font/google"; // Updated fonts
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthListener } from "@/components/auth-listener";
import { NotificationListener } from "@/components/notification-listener";
import { PWAManager } from "@/components/pwa-manager";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const crimsonPro = Crimson_Pro({
  variable: "--font-crimson",
  subsets: ["latin"],
  weight: ['400', '600', '700'],
  style: ['normal'], // Only load normal style, not italic to reduce unused fonts
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "Prayer Marathon - 40 Jours",
  description: "Marathon spirituel de 40 jours de jeûne et prière.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Prayer Marathon",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // App-like feel
  themeColor: "#0F172A", // Dark background color
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning className="dark">
      <head>
        {/* Apple PWA support */}
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Prayer Marathon" />
        {/* Microsoft Tiles */}
        <meta name="msapplication-TileColor" content="#0F172A" />
        <meta name="msapplication-TileImage" content="/icon-192.png" />
      </head>
      <body
        className={`${inter.variable} ${crimsonPro.variable} antialiased bg-[#0F172A] text-slate-50 overflow-x-hidden`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark" // Force dark theme by default as per design
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthListener />
          <NotificationListener />
          <PWAManager />
          {children}
          <Toaster position="top-center" richColors theme="dark" />
        </ThemeProvider>
      </body>
    </html>
  );
}
