import Link from 'next/link';
import { Photo } from '@/components/cards';
import { PublicArticles } from '@/components/public-content';
import { ContactBlock } from '@/components/contact-block';
import { SectionCards } from '@/components/section-cards';
import { publicNavigation } from '@/lib/site-navigation';
import { publicPageUser } from '@/lib/pages';
import { siteLocale } from '@/lib/site-locale';
import { copy } from '@/lib/locale';
export default async function Home() {
  const [user,locale]=await Promise.all([publicPageUser(),siteLocale()]);
  const t=copy(locale),approved=user?.status==='approved';
  const entry=approved?'/academy':user?'/access':'/login';
  const action=approved?t('Перейти в Академию','Go to Academy'):user?t('Проверить статус','Check your access'):t('Войти в академию','Sign in to Academy');
  return <div className="public-home"><section className="hero"><div><span className="eyebrow">JUICY by Nazerke</span><h1>{t('Готовить —','Cooking is')}<br/>{t('значит','about')} <em>{t('вдохновлять','inspiring')}</em></h1><p>{t('Знакомьтесь с возможностями техники, пробуйте новые рецепты и создавайте свои семейные традиции вместе с Назерке.','Discover what your equipment can do, try new recipes, and build your own family traditions with Nazerke.')}</p><div className="cta"><Link className="btn btn-dark" href="/about">{t('Об академии','About the Academy')}</Link><Link className="btn btn-outline" href={entry}>{action} →</Link></div></div><div className="portrait-frame"><Photo name="nazerke-hero.avif" alt={t('Назерке с Kenwood','Nazerke with Kenwood')} priority/><span className="photo-label">{t('JUICY — готовим вместе','JUICY — cook together')}</span></div></section>
    <section className="section home-directory"><h2>{t('Разделы сайта','Explore JUICY')}</h2>
      <SectionCards links={publicNavigation(locale).slice(1)} label={t('Разделы сайта','Site sections')}/>
    </section>
    <section className="section"><div className="section-heading"><h2>{t('Полезно','Good to')} <em>{t('знать','know')}</em></h2><Link href="/articles" className="small-link">{t('Все статьи','All articles')} →</Link></div><PublicArticles locale={locale}/></section>
    <section className="about"><div className="portrait-frame about-photo"><Photo name="nazerke-about.avif" alt={t('Назерке — автор JUICY','Nazerke, founder of JUICY')}/></div><div><span className="eyebrow">{t('Давайте знакомиться','Meet your instructor')}</span><h2>{t('С теплом,','Warmly,')}<br/><em>{t('Назерке','Nazerke')}</em></h2><p className="lead">{t('Место, где сложное становится понятным, а готовка приносит радость.','A place to make the challenging parts of cooking easier and find joy in the kitchen.')}</p><p>{t('JUICY объединяет уроки, рецепты и поддержку в одном пространстве.','JUICY brings lessons, recipes, and support together.')}</p><Link className="btn btn-outline" href="/about">{t('Об академии','About the Academy')} →</Link></div></section>
    <section className="banner"><span className="eyebrow">{t('Доступ в JUICY','Access to JUICY')}</span><h2>{t('Ваша академия —','Your Academy is')}<br/><em>{t('всегда рядом','always close by')}</em></h2>{!user?<p>{t('Академия открыта по приглашениям. Запросите приглашение в Telegram, и команда JUICY рассмотрит заявку.','The Academy is invitation-only. Request an invitation in Telegram and the JUICY team will review it.')}</p>:null}<Link className="btn btn-dark" href={entry}>{user?action:t('Войти или запросить приглашение','Sign in or request an invitation')}</Link></section><ContactBlock locale={locale}/></div>;
}
