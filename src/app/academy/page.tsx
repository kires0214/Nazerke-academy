import Link from 'next/link';
import { contentHref } from '@/components/cards';
import { ContactBlock } from '@/components/contact-block';
import { AcademySections } from '@/components/academy-sections';
import { copy } from '@/lib/locale';
import { academyData } from '@/lib/pages';
import { siteLocale } from '@/lib/site-locale';

export default async function Page() {
  const [{user,nodes,progress},locale]=await Promise.all([academyData(),siteLocale()]);
  const t=copy(locale);
  const resume=nodes.find(node=>node.id===progress[0]?.lesson_id),first=nodes.find(node=>node.kind==='lesson');
  const nextLesson=resume??first;
  return <>
    <div className="academy-welcome">
      <h1>{t('Рады видеть вас,','Welcome,')} <span>{user.display_name}</span></h1>
      {nextLesson?<Link className="btn btn-dark btn-small" href={contentHref(nextLesson)}>{resume?t('Продолжить','Continue'):t('Начать','Start here')} →</Link>:null}
    </div>
    <section className="section academy-topics"><h2>{t('Разделы','Sections')}</h2><AcademySections locale={locale} all/></section>
    <ContactBlock locale={locale} academy/>
  </>;
}
