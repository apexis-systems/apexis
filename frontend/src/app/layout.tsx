import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Providers from "@/components/Providers";

const angelica = localFont({
  src: "../../public/fonts/Angelica-C.otf",
  variable: "--font-angelica",
});

const montserrat = localFont({
  src: "../../public/fonts/Montserrat-Regular.ttf",
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "APEXIS PRO™",
  description: "APEXIS PRO™ Hub application",
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
    <html lang="en" className={`${angelica.variable} ${montserrat.variable}`}>
      <body
        className="antialiased font-montserrat"
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
