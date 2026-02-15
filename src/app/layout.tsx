import type {Metadata} from 'next';
import { Inter, Noto_Sans_KR } from 'next/font/google'
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const noto = Noto_Sans_KR({ 
  subsets: ['latin'], 
  weight: ['400', '500', '700', '900'],
  variable: '--font-noto'
})

export const metadata: Metadata = {
  title: 'Field Focus | Hockey Analytics',
  description: 'Parse, analyze, and visualize field hockey match data.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${noto.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="font-body antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
