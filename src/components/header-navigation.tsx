'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect,useRef } from 'react';
import { copy,type SiteLocale } from '@/lib/locale';

export type HeaderLink={href:string;label:string};

export function HeaderNavigation({links,locale}:{links:HeaderLink[];locale:SiteLocale}) {
  const path=usePathname();
  const t=copy(locale);
  const nav=useRef<HTMLElement>(null);
  const active=links.find(({href})=>path===href)?.href??
    links.find(({href})=>href!=='/'&&href!=='/academy'&&path?.startsWith(href+'/'))?.href;

  useEffect(()=>{
    const list=nav.current;
    const current=list?.querySelector('[aria-current]');
    if(!list||!current)return;
    const bounds=list.getBoundingClientRect(), item=current.getBoundingClientRect();
    if(item.left<bounds.left)list.scrollLeft+=item.left-bounds.left-4;
    if(item.right>bounds.right)list.scrollLeft+=item.right-bounds.right+4;
  },[active]);
  return <nav ref={nav} className="header-navigation" aria-label={t('Основная навигация','Main navigation')}>
    {links.map(({href,label})=><Link key={href} className="header-control header-nav-link" href={href}
      aria-current={active===href?(path===href?'page':'location'):undefined}>{label}</Link>)}
  </nav>;
}
