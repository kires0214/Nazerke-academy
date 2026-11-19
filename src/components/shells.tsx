import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Principal } from '@/lib/security';
import { hasGrant, isStudioRole } from '@/lib/security';

export function Logo({name='by Nazerke',href='/'}:{name?:string;href?:string}) {
  return <Link className="logo" href={href} aria-label={`JUICY ${name}`}><strong>JUICY</strong><small>{name}</small></Link>;
}
export function PublicShell({children}:{children:ReactNode}) {
  return <><header className="header"><div className="wrap nav"><Logo/><nav className="desktop-links" aria-label="Основная навигация">
    <Link href="/">Главная</Link><Link href="/about">Об академии</Link><Link href="/articles">Статьи</Link><Link href="/events">Мастер-классы</Link><Link href="/contacts">Контакты</Link>
  </nav><div className="actions"><Link className="btn btn-dark" href="/login">Войти</Link><details className="mobile-menu"><summary>Меню</summary><nav><Link href="/about">Об академии</Link><Link href="/articles">Статьи</Link><Link href="/events">Мастер-классы</Link><Link href="/contacts">Контакты</Link></nav></details></div></div></header>
  <main id="main" className="wrap">{children}</main><footer className="footer"><div className="wrap foot-grid"><Logo/><div className="foot-nav"><Link href="/contacts">Поддержка</Link><Link href="/privacy">Конфиденциальность</Link><Link href="/terms">Правила доступа</Link></div><small>Готовим с уверенностью.<br/>Учимся вместе.</small></div></footer></>;
}
const academyNav=[['/academy','Главная'],['/academy/learn','Обучение'],['/academy/recipes','Рецепты'],['/academy/events','Мастер-классы'],['/academy/materials','Материалы'],['/academy/club','JUICY Club']];
export function AcademyShell({user,children}:{user:Principal;children:ReactNode}) {
  return <div className="wrap academy"><header className="academy-nav"><Logo name="Academy" href="/academy"/><nav aria-label="Академия">{academyNav.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</nav>
    <div className="actions">{user.status==='approved'&&isStudioRole(user.role)?<Link className="studio-switch" href="/admin" aria-label="Открыть JUICY Studio">Studio</Link>:null}<Link className="search-icon" href="/academy/search" aria-label="Поиск">⌕</Link><Link className="avatar" href="/academy/profile" aria-label="Мой профиль">{user.display_name.slice(0,1)}</Link></div></header>
    <main id="main" className="academy-content">{children}</main><nav className="bottom-nav" aria-label="Мобильная навигация">{[['/academy','Главная'],['/academy/learn','Обучение'],['/academy/recipes','Рецепты'],['/academy/events','Встречи'],['/academy/more','Ещё']].map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</nav></div>;
}
export function StudioShell({user,children}:{user:Principal;children:ReactNode}) {
  const tabs=[['/admin','Контент',hasGrant(user,'content.read')],['/admin/users','Доступ',hasGrant(user,'students.read')],['/admin/media','Медиа',hasGrant(user,'media.upload')||hasGrant(user,'media.delete')],['/admin/support','Поддержка',hasGrant(user,'support.read')],['/admin/audit','Аудит',hasGrant(user,'audit.read')]];
  return <div className="wrap admin"><header className="nav studio-header"><Logo name="Studio" href="/admin"/><Link className="btn btn-outline" href="/academy">В Академию</Link></header>
    <div className="admin-grid"><nav className="admin-sidebar" aria-label="Studio">{tabs.filter(x=>x[2]).map(([href,label])=><Link key={String(href)} href={String(href)}>{label}</Link>)}</nav><main id="main" className="admin-panel">{children}</main></div></div>;
}
