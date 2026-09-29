import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ProjectProvider } from "@/lib/project-context";
import { Toaster } from "@/components/ui/sonner";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export const metadata: Metadata = {
  title: "Parking Management System",
  description: "Real-time multi-project parking management for commercial buildings and campuses",
  applicationName: "Parking Management System",
  icons: {
    icon: [{ url: "/icon.svg?v=2", type: "image/svg+xml" }],
    shortcut: [{ url: "/icon.svg?v=2", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg?v=2", type: "image/svg+xml" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Parking Management System",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jakartaSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <AuthProvider>
          <ProjectProvider>{children}</ProjectProvider>
        </AuthProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
