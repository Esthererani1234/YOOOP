import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YOOOP — Everything you need, found fast",
  description: "A simple, affordable marketplace built around fast discovery and reliable delivery."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
