import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claude Academy | Certification",
  description: "Build your Claude skills and earn your certification.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
