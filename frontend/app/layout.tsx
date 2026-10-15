import type { Metadata } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/app-shell";
export const metadata: Metadata = {
  title: "Atmosphere AI · Environmental intelligence",
  description:
    "A clearer view of the air. Real environmental data and evaluated air quality forecasting.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
