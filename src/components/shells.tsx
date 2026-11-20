import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Principal } from '@/lib/security';
import { hasGrant, isStudioRole } from '@/lib/security';
import { StudioNav } from './studio-nav';
import { LogoutButton } from './actions';
import { copy,type SiteLocale } from '@/lib/locale';
import { LanguageSwitch,ReaderLanguageProvider } from './reader-language';
import { academyNavigation,publicNavigation } from '@/lib/site-navigation';

export function Logo({name='by Nazerke',href='/'}:{name?:string;href?:string}) {
  return <Link className="logo" href={href} aria-label={`JUICY ${name}`}><strong>JUICY</strong><small>{name}</small></Link>;
}
export function PublicShell({children,user,locale='ru'}:{children:ReactNode;user?:Pick<Principal,'status'>|null;locale?:SiteLocale}) {
  const t=copy(locale);
  const navigation=publicNavigation(locale).map(({href,label})=><Link key={href} href={href}>{label}</Link>);
  return <ReaderLanguageProvider locale={locale}><header className="header"><div className="wrap nav"><Logo/>
    <nav className="desktop-links" aria-label={t('Основная навигация','Main navigation')}>{navigation}</nav>
    <div className="actions"><LanguageSwitch locale={locale}/>{user?<div className="public-session">
      <span>{t('Вы вошли','Signed in')}</span><Link className="btn btn-dark" href={user.status==='approved'?'/academy':'/access'}>
        {user.status==='approved'?t('В Академию','Go to Academy'):t('Мой доступ','My access')}</Link>
    </div>:<Link className="btn btn-dark" href="/login">{t('Войти','Sign in')}</Link>}
    <details className="mobile-menu"><summary>{t('Меню','Menu')}</summary><nav>{navigation}</nav></details></div></div></header>
    <main id="main" className="wrap">{children}</main><footer className="footer"><div className="wrap foot-grid"><Logo/>
      <div className="foot-nav"><Link href="/contacts">{t('Контакты','Contact')}</Link><Link href="/privacy">{t('Конфиденциальность','Privacy')}</Link>
        <Link href="/terms">{t('Правила доступа','Access rules')}</Link></div>
      <small>{t('Готовим с уверенностью.','Cook with confidence.')}<br/>{t('Учимся вместе.','Learn together.')}</small></div></footer>
  </ReaderLanguageProvider>;
}
export function AcademyShell({user,children,locale='ru'}:{user:Principal;children:ReactNode;locale?:SiteLocale}) {
  const t=copy(locale);
  const academyNav=academyNavigation(locale);
  const mobileNav=[academyNav[0],academyNav[1],{href:'/academy/learn',label:t('Разделы','Sections')},
    {href:'/academy/events',label:t('Встречи','Events')},{href:'/academy/coming-soon',label:t('Скоро','Soon')}];
  return <ReaderLanguageProvider locale={locale}><div className="wrap academy"><header className="academy-nav"><Logo name="Academy" href="/academy"/>
    <nav className="academy-main-nav" aria-label={t('Академия','Academy')}>{academyNav.map(({href,label})=><Link key={href} href={href}>{label}</Link>)}</nav>
    <div className="actions"><LanguageSwitch locale={locale}/>
      <Link className="public-site-link" href="/" aria-label={t('На публичный сайт','Go to public site')} title={t('На публичный сайт','Go to public site')}>
        <span className="public-site-label">{t('Публичный сайт','Public site')}</span><span aria-hidden="true">↗</span></Link>
      {user.status==='approved'&&isStudioRole(user.role)?<Link className="studio-switch" href="/admin" aria-label={t('Открыть JUICY Studio','Open JUICY Studio')}>Studio</Link>:null}
      <Link className="search-icon" href="/academy/search" aria-label={t('Поиск','Search')}>⌕</Link>
      <Link className="avatar" href="/academy/profile" aria-label={t('Мой профиль','My profile')}>{user.display_name.slice(0,1)}</Link><LogoutButton/></div></header>
    <main id="main" className="academy-content">{children}</main>
    <footer className="academy-footer"><Logo name="Academy" href="/academy"/>
      <nav className="foot-nav" aria-label={t('Ссылки Академии','Academy footer links')}>
        <Link href="/academy/contacts">{t('Контакты','Contact')}</Link><Link href="/privacy">{t('Конфиденциальность','Privacy')}</Link>
      </nav>
    </footer>
    <nav className="bottom-nav" aria-label={t('Мобильная навигация','Mobile navigation')}>{mobileNav.map(({href,label})=><Link key={href} href={href}>{label}</Link>)}</nav>
  </div></ReaderLanguageProvider>;
}
export function StudioShell({user,children}:{user:Principal;children:ReactNode}) {
  const tabs=[['/admin','Контент',hasGrant(user,'content.read')],['/admin/users','Доступ',hasGrant(user,'students.read')],['/admin/media','Медиафайлы',hasGrant(user,'media.upload')||hasGrant(user,'media.delete')],['/admin/support','Поддержка',hasGrant(user,'support.read')],['/admin/audit','Аудит',hasGrant(user,'audit.read')]] as const;
  return <div className="wrap admin" lang="ru"><header className="nav studio-header"><Logo name="Studio" href="/admin"/>
    <div className="actions"><Link className="public-site-link" href="/">Публичный сайт <span aria-hidden="true">↗</span></Link><Link className="btn btn-outline" href="/academy">В Академию</Link><LogoutButton/></div></header>
    <div className="admin-grid"><StudioNav tabs={tabs.filter(([, , allowed])=>allowed).map(([href,label])=>({href,label}))}/>
      <main id="main" className="admin-panel">{children}</main></div></div>;
}
