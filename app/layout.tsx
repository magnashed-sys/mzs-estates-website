import "./globals.css";

export const metadata = {
  title: "MZS Group",
  description: "Private. Independent. International.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
