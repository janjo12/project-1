import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Dungeon Run",
  description: "A seeded, turn-based dungeon adventure.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
