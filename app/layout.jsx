import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "FirstFly Airways",
  description:
    "A full-stack airline booking platform with real-time seat locking, secure payments, QR boarding passes, and online check-in.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3500,
            style: {
              background: "#1a1a1a",
              color: "#f0ebe0",
              borderRadius: "12px",
              padding: "14px 18px",
              fontFamily: "'DM Sans', sans-serif",
            },
          }}
        />
        {/* 🔥 NAVBAR */}
        <Navbar />

        <main className="flex-1">
          {children}
        </main>

      </body>
    </html>
  );
}
