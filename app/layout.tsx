import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paper Football Duel — Meet me at the table",
  description: "A friendly tabletop duel with little football kickers, a small American football, movable yellow goalposts, and ten-yard rounds. Pull back and release to kick.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
