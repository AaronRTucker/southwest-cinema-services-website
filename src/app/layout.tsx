import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Southwest Cinema Services, LLC",
  description: "Installation, service, and proactive monitoring of Barco and Christie digital cinema projectors and sound systems across the Southwest.",
  openGraph: {
    title: "Southwest Cinema Services, LLC",
    description: "Installation, service, and proactive monitoring of Barco and Christie digital cinema projectors and sound systems across the Southwest.",
    url: "https://southwestcinemaservices.com",
    siteName: "Southwest Cinema Services",
    images: [
      {
        url: "https://southwestcinemaservices.com/images/logo-gemini.png",
        width: 600,
        height: 373,
        alt: "Southwest Cinema Services logo",
      },
    ],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
