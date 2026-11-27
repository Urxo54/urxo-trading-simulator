
import type { Metadata } from "next";
import ThemeProvider from "@/components/theme-provider";
import WelcomeOnboarding from "@/components/welcome-onboarding";
import "./globals.css";

export const metadata: Metadata = {
  title: "URXO Trading Lab",
  description: "Historical Market Trading Simulator",
};

const themeScript = `(function(){try{var t=localStorage.getItem("urxo-theme");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body><ThemeProvider>{children}<WelcomeOnboarding /></ThemeProvider></body>
    </html>
  );
}
