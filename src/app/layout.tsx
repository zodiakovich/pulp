import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pulp — AI MIDI Generator',
  description: 'Describe the track. AI generates the MIDI. Precision tools for modern producers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-bg font-body text-[#F0F0FF] antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
