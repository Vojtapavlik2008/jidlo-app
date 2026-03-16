import "./globals.css";
import { OrderProvider } from "@/app/components/order/order-context";
import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "Jiřka",
  description: "Zdravá výživa Jiřka – objednávky jídel, denní menu a správa objednávek.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs" className="bg-white">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <OrderProvider>
          <div className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-4 md:px-6 md:py-6 lg:px-8">
            {children}
          </div>
        </OrderProvider>
      </body>
    </html>
  );
}