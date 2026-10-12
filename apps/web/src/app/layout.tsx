import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { Providers } from "./providers";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Adam PreCare", template: "%s · Adam PreCare" },
  description: "Dashboard operator Adam PreCare — Pre-Hospital & Incident Emergency System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={poppins.variable}>
      <body className="min-h-dvh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
