import Link from 'next/link';
import { copy, contentLang, type SiteLocale } from '@/lib/locale';
import type { starterProgram } from '@/lib/starter-program';
import { contentHref } from './cards';

export const starterProfileHref='/academy/profile#starter';

export function StarterProgram({locale,program,dashboard=false}:{
  locale:SiteLocale;program:ReturnType<typeof starterProgram>;dashboard?:boolean;
}) {
  const t=copy(locale);
  const {courses,finished,remaining}=program;
  if(dashboard&&!remaining)return null;
  const title=t('Стартовая программа','Getting started');
  const progress=t(`Курсы завершены: ${finished} из ${courses.length}`,`Courses completed: ${finished} of ${courses.length}`);
  return <section id={dashboard?undefined:'starter'} className={'starter-program'+(dashboard?' starter-dashboard':'')} aria-labelledby="starter-title">
    <div className="starter-head">
      <div>
        <h2 id="starter-title">{title}</h2>
        {courses.length?<p>{remaining?progress:t('Стартовая программа пройдена.','You completed the starter program.')}</p>:
          <p>{t('Здесь появятся стартовые курсы, доступные по вашим допускам.','Starter courses will appear here when available to you.')}</p>}
      </div>
    </div>
    {courses.length?<progress className="starter-progress" value={finished} max={courses.length} aria-label={progress}/>:null}
    {courses.length?<ul className="starter-courses">
      {courses.map(({course,nextLesson,done,total})=><li key={course.id}>
        <div>
          <Link className="starter-course-name" href={contentHref(course)} lang={contentLang(course.language)}>{course.title}</Link>
          <p>{t(`Уроки: ${done} из ${total}`,`Lessons: ${done} of ${total}`)}{!nextLesson?t(' · Пройдено',' · Completed'):''}</p>
        </div>
        <Link className="btn btn-outline btn-small" href={contentHref(nextLesson??course)}>
          {nextLesson?(done?t('Продолжить','Continue'):t('Начать','Start')):t('Повторить','Review')}
        </Link>
      </li>)}
    </ul>:null}
  </section>;
}
