import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Principal } from '@/lib/security';
import { hasGrant, isStudioRole } from '@/lib/security';
import { StudioNav } from './studio-nav';
import { LogoutButton } from './actions';
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
export function PublicShell({children,user,locale='ru'}:{children:ReactNode;user?:Pick<Principal,'status'>|null;locale?:SiteLocale}) {
  const t=copy(locale);
  return <ReaderLanguageProvider locale={locale}><SiteHeader links={publicNavigation(locale)} locale={locale}>
    <LanguageSwitch locale={locale}/>
    {user?<span className="header-session">{t('Вы вошли','Signed in')}</span>:null}
    <Link className="header-control header-primary" href={user?.status==='approved'?'/academy':user?'/access':'/login'}>
      {user?.status==='approved'?t('В Академию','Go to Academy'):user?t('Мой доступ','My access'):t('Войти','Sign in')}</Link>
  </SiteHeader>
    <main id="main" className="wrap">{children}</main><footer className="footer"><div className="wrap foot-grid"><Logo/>
      <div className="foot-nav"><Link href="/contacts">{t('Контакты','Contact')}</Link><Link href="/privacy">{t('Конфиденциальность','Privacy')}</Link>
        <Link href="/terms">{t('Правила доступа','Access rules')}</Link></div>
      <small>{t('Готовим с уверенностью.','Cook with confidence.')}<br/>{t('Учимся вместе.','Learn together.')}</small></div></footer>
  </ReaderLanguageProvider>;
}
export function AcademyShell({user,children,locale='ru'}:{user:Principal;children:ReactNode;locale?:SiteLocale}) {
  const t=copy(locale);
  const academyNav=academyNavigation(locale);
  const hasStudio=user.status==='approved'&&isStudioRole(user.role);
  const mobileNav=[academyNav[0],academyNav[1],{href:'/academy/learn',label:t('Разделы','Sections')},
    {href:'/academy/events',label:t('Встречи','Events')},{href:'/academy/coming-soon',label:t('Скоро','Soon')}];
  return <ReaderLanguageProvider locale={locale}><SiteHeader name="Academy" home="/academy" locale={locale}
    links={hasStudio?[...academyNav,{href:'/admin',label:'Studio',mobileOnly:true}]:academyNav}>
    <LanguageSwitch locale={locale}/>
    <Link className="header-control header-primary" href="/" aria-label={t('На публичный сайт','Go to public site')}>{t('На сайт','Public site')}</Link>
    {hasStudio?<Link className="header-control header-studio-link" href="/admin" aria-label={t('Открыть JUICY Studio','Open JUICY Studio')}>Studio</Link>:null}
    <Link className="header-control header-square" href="/academy/search" aria-label={t('Поиск','Search')}><span className="header-search-icon" aria-hidden="true"/></Link>
    <Link className="header-control header-square header-avatar" href="/academy/profile" aria-label={t('Мой профиль','My profile')}>{Array.from(user.display_name.trim())[0]}</Link>
    <LogoutButton header/>
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
export function StudioShell({user,children}:{user:Principal;children:ReactNode}) {
  const tabs=[['/admin','Контент',hasGrant(user,'content.read')],['/admin/users','Доступ',hasGrant(user,'students.read')],['/admin/media','Медиафайлы',hasGrant(user,'media.upload')||hasGrant(user,'media.delete')],['/admin/support','Поддержка',hasGrant(user,'support.read')],['/admin/audit','Аудит',hasGrant(user,'audit.read')]] as const;
  return <div lang="ru"><SiteHeader name="Studio" home="/admin" locale="ru">
    <Link className="header-control" href="/">На сайт</Link><Link className="header-control header-primary" href="/academy">В Академию</Link><LogoutButton header/>
  </SiteHeader>
    <div className="wrap admin"><div className="admin-grid"><StudioNav tabs={tabs.filter(([, , allowed])=>allowed).map(([href,label])=>({href,label}))}/>
      <main id="main" className="admin-panel">{children}</main></div></div></div>;
}
