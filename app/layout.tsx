import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "[Project 1]",
  description: "Play a seeded dungeon adventure solo or with friends.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
