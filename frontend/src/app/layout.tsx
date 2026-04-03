import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "APEXIS",
  description: "APEXIS Hub application",
  icons: {
    icon: "/favicon.ico", // Standard favicon
    apple: "/app-icon.png", // Apple touch icon
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased font-sans"
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
