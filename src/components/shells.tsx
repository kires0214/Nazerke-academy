import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Principal } from '@/lib/security';
import { hasGrant, isStudioRole } from '@/lib/security';
import { StudioNav } from './studio-nav';
import { ProfileMenu } from './profile-menu';
import { copy,type SiteLocale } from '@/lib/locale';
import { LanguageSwitch,ReaderLanguageProvider } from './reader-language';
import { academyNavigation,publicNavigation } from '@/lib/site-navigation';
import { HeaderNavigation,type HeaderLink } from './header-navigation';

export function Logo({name='by Nazerke',href='/'}:{name?:string;href?:string}) {
  return <Link className="logo" href={href} aria-label={`JUICY ${name}`}><strong>JUICY</strong><small>{name}</small></Link>;
}
function SiteHeader({name,home,links,locale,children}:{
  name?:string;home?:string;links?:HeaderLink[];locale:SiteLocale;children:ReactNode;
}) {
  return <header className="juicy-header">
    <div className={`juicy-header-inner${links?'':' juicy-header-compact'}`}>
      <Logo name={name} href={home}/>
      {links?<HeaderNavigation links={links} locale={locale}/>:null}
      <div className="header-actions">{children}</div>
    </div>
  </header>;
}
export function PublicShell({children,user,locale='ru'}:{children:ReactNode;user?:Pick<Principal,'status'>&Partial<Pick<Principal,'role'>>|null;locale?:SiteLocale}) {
  const t=copy(locale);
  const approved=user?.status==='approved';
  return <ReaderLanguageProvider locale={locale}><SiteHeader links={publicNavigation(locale)} locale={locale}>
    {!user?<LanguageSwitch locale={locale}/>:null}
    {user?<span className="header-session">{t('Вы вошли','Signed in')}</span>:null}
    <Link className="header-control header-primary" href={approved?'/academy':user?'/access':'/login'}>
      {approved?t('В Академию','Go to Academy'):user?t('Мой доступ','My access'):t('Войти','Sign in')}</Link>
    {user?<ProfileMenu locale={locale} approved={approved} studio={approved&&!!user.role&&isStudioRole(user.role)}/>:null}
  </SiteHeader>
    <main id="main" className="wrap public-main">{children}</main><footer className="footer"><div className="wrap foot-grid"><Logo/>
      <nav className="foot-nav" aria-label={t('Ссылки сайта','Site footer links')}><Link href="/contacts">{t('Контакты','Contact')}</Link><Link href="/privacy">{t('Конфиденциальность','Privacy')}</Link>
        <Link href="/terms">{t('Правила доступа','Access rules')}</Link></nav>
      <small>{t('Готовим с уверенностью.','Cook with confidence.')}<br/>{t('Учимся вместе.','Learn together.')}</small></div></footer>
  </ReaderLanguageProvider>;
}
export function AcademyShell({user,children,locale='ru'}:{user:Principal;children:ReactNode;locale?:SiteLocale}) {
  const t=copy(locale);
  const academyNav=academyNavigation(locale).filter(link=>link.href!=='/academy/coming-soon');
  const hasStudio=user.status==='approved'&&isStudioRole(user.role);
  const mobileNav=[academyNav[0],academyNav[1],{href:'/academy/learn',label:t('Разделы','Sections')},
    {href:'/academy/events',label:t('Встречи','Events')},academyNav.at(-1)!];
  return <ReaderLanguageProvider locale={locale}><SiteHeader name="Academy" home="/academy" locale={locale} links={academyNav}>
    <Link className="header-control header-primary" href="/" aria-label={t('На публичный сайт','Go to public site')}>{t('На сайт','Public site')}</Link>
    <ProfileMenu locale={locale} approved={user.status==='approved'} studio={hasStudio}/>
  </SiteHeader><div className="wrap academy">
    <main id="main" className="academy-content">{children}</main>
    <footer className="academy-footer"><Logo name="Academy" href="/academy"/>
      <nav className="foot-nav" aria-label={t('Ссылки Академии','Academy footer links')}>
        <Link href="/academy/contacts">{t('Контакты','Contact')}</Link><Link href="/privacy">{t('Конфиденциальность','Privacy')}</Link>
      </nav>
    </footer>
    <nav className="bottom-nav" aria-label={t('Мобильная навигация','Mobile navigation')}>{mobileNav.map(({href,label})=><Link key={href} href={href}>{label}</Link>)}</nav>
  </div></ReaderLanguageProvider>;
}
export function StudioShell({user,children,locale='ru'}:{user:Principal;children:ReactNode;locale?:SiteLocale}) {
  const t=copy(locale);
  const tabs=[['/admin','Контент',hasGrant(user,'content.read')],['/admin/users','Доступ',hasGrant(user,'students.read')],['/admin/media','Медиафайлы',hasGrant(user,'media.upload')||hasGrant(user,'media.delete')],['/admin/support','Поддержка',hasGrant(user,'support.read')],['/admin/audit','Аудит',hasGrant(user,'audit.read')]] as const;
  return <ReaderLanguageProvider locale={locale}><SiteHeader name="Studio" home="/admin" locale={locale}>
    <Link className="header-control" href="/">{t('На сайт','Public site')}</Link>
    <Link className="header-control header-primary" href="/academy">{t('В Академию','Go to Academy')}</Link>
    <ProfileMenu locale={locale} approved={user.status==='approved'} studio={user.status==='approved'&&isStudioRole(user.role)}/>
  </SiteHeader>
    <div className="wrap admin" lang="ru"><div className="admin-grid"><StudioNav tabs={tabs.filter(([, , allowed])=>allowed).map(([href,label])=>({href,label}))}/>
      <main id="main" className="admin-panel">{children}</main></div></div></ReaderLanguageProvider>;
}
