import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.scss";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  weight: "45 920",
  style: "normal",
  display: "swap",
  variable: "--font-pretendard",
  fallback: [
    "system-ui",
    "Apple SD Gothic Neo",
    "Noto Sans KR",
    "Malgun Gothic",
    "sans-serif",
  ],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "의료 문진 도우미",
  description: "의료진에게 증상을 설명할 수 있도록 문진을 돕습니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>{children}</body>
    </html>
  );
}
