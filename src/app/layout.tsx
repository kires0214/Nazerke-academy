import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:{default:'JUICY by Nazerke',template:'%s · JUICY'},description:'Кулинарная академия Назерке. Знакомимся с Kenwood и готовим с уверенностью.'};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="ru"><body><a className="skip-link" href="#main">К содержимому</a>{children}</body></html>;
}
