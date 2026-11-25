import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'WebCraft Academy — Learn by building', description: 'A hands-on HTML and CSS learning playground for curious creators.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
