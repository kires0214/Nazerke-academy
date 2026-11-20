import Link from 'next/link';
import { ContentCards,contentHref } from '@/components/cards';
import { AcademySections } from '@/components/academy-sections';
import { copy } from '@/lib/locale';
import { academyData } from '@/lib/pages';
import { siteLocale } from '@/lib/site-locale';

export default async function Page() {
  const [{user,nodes,catalog,progress},locale]=await Promise.all([academyData(),siteLocale()]);
  const t=copy(locale);
  const resume=nodes.find(node=>node.id===progress[0]?.lesson_id),first=nodes.find(node=>node.kind==='lesson');
  const nextLesson=resume??first;
  const events=catalog.filter(node=>node.kind==='event'&&node.data.startsAt&&Date.parse(node.data.startsAt)>Date.now());
  const news=nodes.filter(node=>node.kind==='post'&&node.data.postKind==='news');
  return <>
    <div className="academy-welcome">
      <h1>{t('Рады видеть вас,','Welcome,')} <span>{user.display_name}</span></h1>
      {nextLesson?<Link className="small-link" href={contentHref(nextLesson)}>{resume?t('Продолжить','Continue'):t('Начать','Start here')} →</Link>:null}
    </div>
    <section className="section academy-topics"><h2>{t('Разделы','Sections')}</h2><AcademySections locale={locale}/></section>
    <section className="section"><div className="section-heading"><h2>{t('Новые рецепты','New recipes')}</h2>
      <Link className="small-link" href="/academy/recipes">{t('Все рецепты','All recipes')} →</Link></div>
      <ContentCards nodes={catalog.filter(node=>node.kind==='recipe').slice(0,3)} locale={locale}/>
    </section>
    {news.length?<section className="section"><h2>{t('Новости JUICY','JUICY news')}</h2><ContentCards nodes={news} locale={locale}/></section>:null}
    {events.length?<section className="section"><h2>{t('Ближайшие встречи','Upcoming events')}</h2><ContentCards nodes={events} locale={locale}/></section>:null}
  </>;
}
