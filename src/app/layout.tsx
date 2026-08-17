import type {Metadata} from 'next';
import { Inter, Noto_Sans_KR, Archivo } from 'next/font/google'
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const noto = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-noto'
})
// Archivo는 한글(Hangul)을 지원하지 않는 서체 — 영문/숫자 텍스트에만 적용되고,
// 한글 텍스트는 자동으로 Noto Sans KR로 폴백된다(정상 동작, 버그 아님).
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '600', '800'],
  variable: '--font-archivo',
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
    <html lang="en" className={`${inter.variable} ${noto.variable} ${archivo.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
