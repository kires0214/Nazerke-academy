'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function StudioNav({tabs}:{tabs:{href:string;label:string}[]}) {
  const path=usePathname()??'/admin';
  const section=path.split('/')[2];
  const active=section&&tabs.some(tab=>tab.href==='/admin/'+section)?'/admin/'+section:'/admin';
  return <nav className="admin-sidebar" aria-label="Studio">
    {tabs.map(({href,label})=><Link key={href} href={href} aria-current={href===active?'page':undefined}>{label}</Link>)}
  </nav>;
}
