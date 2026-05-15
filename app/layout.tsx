import type { Metadata } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond, Azeret_Mono, Modak } from "next/font/google";
import Providers from "@/src/components/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

// Phase 6 B2.1 — sound-spheres 视觉系统字体（serif 用于 logo / mono 用于节点 label）
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  weight: ["300", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const azeretMono = Azeret_Mono({
  variable: "--font-azeret",
  weight: ["300", "400"],
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

// Phase 6 B6 — 球内嵌数字 badge 用气球字 Modak（艺术家 demo 5 球数字代号）
const modak = Modak({
  variable: "--font-modak",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "Ripples in the Pond",
  description: "音乐 NFT 铸造平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning 仅压制 html/body 根节点 — 处理浏览器扩展（NeonLingo / Monica AI 之类）
    // 在 React hydrate 前往 html/body 注入 CSS 变量或 data 属性导致的 hydration mismatch；
    // 子树的真实 hydration bug 仍会正常报警。
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} ${azeretMono.variable} ${modak.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
