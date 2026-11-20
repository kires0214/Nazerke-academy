'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef,useState } from 'react';
import { copy,type SiteLocale } from '@/lib/locale';

export type HeaderLink={href:string;label:string;mobileOnly?:boolean};

export function HeaderNavigation({links,locale}:{links:HeaderLink[];locale:SiteLocale}) {
  const path=usePathname();
  const t=copy(locale);
  const menu=useRef<HTMLButtonElement>(null);
  const [open,setOpen]=useState(false);
  const active=links.find(({href})=>path===href)?.href??
    links.find(({href})=>href!=='/'&&href!=='/academy'&&path?.startsWith(href+'/'))?.href;

  function closeMenu(event:React.KeyboardEvent) {
    if(event.key==='Escape'&&open){
      setOpen(false);
      menu.current?.focus();
    }
  }

  return <>
    <button type="button" className="header-control header-menu-toggle" ref={menu} aria-controls="header-navigation"
      aria-expanded={open} onClick={()=>setOpen(current=>!current)} onKeyDown={closeMenu}>{t('Меню','Menu')}</button>
    <nav id="header-navigation" className="header-navigation" aria-label={t('Основная навигация','Main navigation')}
      data-open={open} onKeyDown={closeMenu}>
      {links.map(({href,label,mobileOnly})=><Link key={href} className={`header-control header-nav-link${mobileOnly?' header-nav-mobile':''}`} href={href}
        aria-current={active===href?(path===href?'page':'location'):undefined} onClick={()=>setOpen(false)}>{label}</Link>)}
    </nav>
  </>;
}
