import Link from 'next/link';
import { contentHref } from '@/components/cards';
import { AcademySections } from '@/components/academy-sections';
import { StarterProgram } from '@/components/starter-program';
import { copy } from '@/lib/locale';
import { academyData } from '@/lib/pages';
import { siteLocale } from '@/lib/site-locale';
import { starterProgram } from '@/lib/starter-program';

export default async function Page() {
  const [{user,nodes,catalog,progress},locale]=await Promise.all([academyData(),siteLocale()]);
  const t=copy(locale);
  const program=user.role==='student'?starterProgram(nodes,progress):null;
  const resume=progress.find(item=>!item.completed_at);
  const nextLesson=nodes.find(node=>node.id===resume?.lesson_id);
  return <>
    <div className="academy-welcome">
      <h1>{t('Рады видеть вас,','Welcome,')} <span>{user.display_name}</span></h1>
      {nextLesson&&!program?.remaining?<Link className="btn btn-dark btn-small" href={contentHref(nextLesson)}>{t('Продолжить','Continue')} →</Link>:null}
    </div>
    {program?<StarterProgram locale={locale} program={program} dashboard/>:null}
    <section className="section academy-topics"><h2>{t('Разделы','Sections')}</h2><AcademySections locale={locale} catalog={catalog} all/></section>
  </>;
}
