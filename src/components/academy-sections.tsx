import Link from 'next/link';
import { sectionFor, type LearningTrack } from '@/lib/catalog';
import type { CatalogNode } from '@/lib/content';
import { eventTimeZone } from '@/lib/event-time';
import { copy, type SiteLocale } from '@/lib/locale';
import { academyNavigation } from '@/lib/site-navigation';
const images:Record<string,string>={
  offers:'/academy-covers/offers.webp',
  kenwood:'/academy-covers/kenwood.webp',
  braun:'/academy-covers/braun.webp',
  ambassadors:'/academy-covers/ambassadors.webp',
  events:'/academy-covers/events.webp',
  'coming-soon':'/academy-covers/coming-soon.webp',
};
const tracks:Record<string,LearningTrack>={kenwood:'kenwood',braun:'braun',ambassadors:'ambassador'};

export function AcademySections({locale,catalog,all=false}:{locale:SiteLocale;catalog:CatalogNode[];all?:boolean}) {
  const t=copy(locale);
  const links=academyNavigation(locale).map(link=>({...link,section:link.href.replace('/academy/','')}))
    .filter(({section})=>Object.hasOwn(all?images:tracks,section));
  const offers=catalog.filter(node=>node.kind==='post'&&node.data.postKind==='offer').length;
  const upcomingPosts=catalog.filter(node=>node.kind==='post'&&node.data.postKind==='coming-soon').length;
  const now=Date.now();
  const firstEvent=catalog.reduce<number>((first,node)=>{
    const at=node.kind==='event'&&node.data.startsAt?Date.parse(node.data.startsAt):0;
    return at>now&&at<first?at:first;
  },Infinity);
  const upcoming=Number.isFinite(firstEvent)?new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:eventTimeZone}).format(firstEvent):null;
  const descriptions:Record<string,string>={
    offers:t('Предложения и новости о действующих акциях JUICY.','Current promotions and special offers from JUICY.'),
    kenwood:t('От первого включения до замеса, насадок и готовых блюд.','From your first setup to kneading, attachments and finished dishes.'),
    braun:t('Приёмы для повседневной готовки: измельчение, смешивание и быстрые рецепты.','Everyday techniques for chopping, blending and quick recipes.'),
    ambassadors:t('Обучение и практика для тех, кто представляет JUICY.','Training and practice for people who represent JUICY.'),
    events:t('Выберите живую встречу и посмотрите свободные места в календаре.','Find an in-person masterclass and check available seats.'),
    'coming-soon':t('Новые курсы, материалы и встречи, которые мы готовим.','New courses, resources and masterclasses in the works.'),
  };
  return <nav className="academy-heroes" aria-label={t('Разделы Академии','Academy sections')}>
    {links.map(({href,label,section})=>{
      const courses=tracks[section]?catalog.filter(node=>node.kind==='course'&&sectionFor(node.audience,node.data)===tracks[section]):[];
      const available=courses.filter(course=>!course.locked).length;
      const detail=section==='offers'?(offers?t(`Предложений: ${offers}`,`Offers: ${offers}`):t('Акции появятся после публикации','Offers will appear here once published')):
        section==='coming-soon'?(upcomingPosts?t(`Анонсов: ${upcomingPosts}`,`Announcements: ${upcomingPosts}`):t('Анонсы появятся после публикации','Announcements will appear here once published')):
        section==='events'?(upcoming?t(`Ближайшая встреча · ${upcoming}`,`Next masterclass · ${upcoming}`):t('Новые даты появятся в календаре','New dates will appear in the calendar')):
        courses.length===0?t('Курсы готовятся','Courses are in preparation'):
        t(`Доступно курсов: ${available} из ${courses.length}`,`Courses available: ${available} of ${courses.length}`);
      return <Link className={`academy-hero academy-hero-${section}`} href={href} key={href}>
        <div className="academy-hero-art"><img src={images[section]} alt="" width={1140} height={380} loading="lazy" decoding="async"/></div>
        <div className="academy-hero-body">
          <strong className="academy-hero-title">{label}</strong><p>{descriptions[section]}</p>
          <div className="academy-hero-footer"><span>{detail}</span><span className="academy-hero-arrow" aria-hidden="true">→</span></div>
        </div>
      </Link>;
    })}
  </nav>;
}
