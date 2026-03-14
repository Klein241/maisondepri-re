import type { Metadata, Viewport } from "next";
import { Inter, Crimson_Pro } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthListener } from "@/components/auth-listener";
import { NotificationListener } from "@/components/notification-listener";
import { PWAManager } from "@/components/pwa-manager";
import { PushNotificationWrapper } from "@/components/push-wrapper";
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
  title: "Maison de Prière",
  description: "Maison de Prière — Communauté de prière, Bible et partage spirituel.",
  manifest: "/manifest.json",
  openGraph: {
    title: "Maison de Prière",
    description: "Communauté de prière, Bible et partage spirituel.",
    images: ["/icon-512.png"],
    type: "website",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Maison de Prière",
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
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Apple PWA support */}
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Maison de Prière" />
        {/* Microsoft Tiles */}
        <meta name="msapplication-TileColor" content="#0F172A" />
        <meta name="msapplication-TileImage" content="/icon-192.png" />
      </head>
      <body
        className={`${inter.variable} ${crimsonPro.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={true}
          disableTransitionOnChange
        >
          <AuthListener />
          <NotificationListener />
          <PWAManager />
          <PushNotificationWrapper />
          {children}
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
