import { Inter, JetBrains_Mono } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import "@scaffold-ui/components/styles.css";
import type { Metadata } from "next";
import { ClientProviders } from "~~/components/ClientProviders";
import { ThemeProvider } from "~~/components/ThemeProvider";
import "~~/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://fredlabs.xyz"),
  title: "FredLabs",
  description: "Submit ideas, stake $FRED, and earn rewards when they get built. Powered by Clawfred.",
  openGraph: {
    title: "FredLabs — Community-Driven Ideas",
    description: "Submit ideas, stake $FRED, and earn rewards when they get built. Powered by Clawfred.",
    images: ["/og-image.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "FredLabs — Community-Driven Ideas",
    description: "Submit ideas, stake $FRED, and earn rewards when they get built. Powered by Clawfred.",
    images: ["/og-image.jpg"],
  },
};

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <html suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans">
        <ThemeProvider enableSystem>
          <ClientProviders>{children}</ClientProviders>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default ScaffoldEthApp;
