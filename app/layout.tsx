import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "QR Studio — Free QR Code Generator",
  description: "Create, customize and download QR codes. Generate bulk QR codes, Wi-Fi, email, URL, text, phone, Bitcoin and PDF link QR codes.",
  applicationName: "QR Studio"
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}