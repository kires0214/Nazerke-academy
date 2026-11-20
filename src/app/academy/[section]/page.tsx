import Link from 'next/link';
import { notFound,redirect } from 'next/navigation';
import { ContentCards,PageHead,contentHref } from '@/components/cards';
import { AcademySections } from '@/components/academy-sections';
import { ArticleCards,builtinArticles } from '@/components/public-content';
import { CatalogTabs } from '@/components/catalog-tabs';
import { CityInterestForm,SupportForm } from '@/components/actions';
import { EventCalendar } from '@/components/event-calendar';
import { catalogGroups,groupFor,sectionFor,trackLabels } from '@/lib/catalog';
import { filterContent } from '@/lib/content';
import { withDb } from '@/lib/db';
import { eventsWithSeats } from '@/lib/events';
import { contentLang,contentLanguages,copy } from '@/lib/locale';
import { academyData,pageTokens } from '@/lib/pages';
import { principal } from '@/lib/security';
import { siteLocale } from '@/lib/site-locale';
import { supportHistory } from '@/lib/support';

export default async function Page({params,searchParams}:{params:Promise<{section:string}>;searchParams:Promise<Record<string,string|undefined>>}) {
  const [{section},search,{user,nodes,catalog,progress,favorites,articleFavorites,links},locale]=await Promise.all([params,searchParams,academyData(),siteLocale()]);
  const t=copy(locale);
  if(section==='learn') return <><PageHead title={t('Разделы','Sections')}/><AcademySections locale={locale}/></>;
  if(section==='kenwood'||section==='braun'||section==='ambassadors') {
    const track=section==='ambassadors'?'ambassador':section;
    const group=catalogGroups.find(group=>group===search.group)??'training';
    const label=track==='ambassador'?t('Школа Амбассадора','Ambassador School'):trackLabels[track];
    const items=catalog.filter(node=>!node.parent_id&&node.kind!=='event'&&node.data.postKind!=='offer'&&
      sectionFor(node.audience,node.data)===track&&groupFor(node.kind,node.data)===group);
    const intro=group==='training'&&track==='kenwood'?items.find(node=>node.kind==='course'&&node.slug==='kenwood'):undefined;
    const modules=new Set(intro?catalog.filter(node=>node.parent_id===intro.id).map(node=>node.id):[]);
    const lessons=catalog.filter(node=>node.kind==='lesson'&&node.parent_id&&modules.has(node.parent_id));
    const cards=items.filter(node=>node.id!==intro?.id||!lessons.length);
    return <>
      <PageHead title={label}/>
      <CatalogTabs section={track} active={group} locale={locale}/>
      {lessons.length&&intro?<section className="section equipment-intro"><h2 lang={contentLang(intro.language)}>{intro.title}</h2>
        <div className="course-steps">{lessons.map((node,index)=><Link href={contentHref(node)} className="step" key={node.id}>
          <span className="step-num">{progress.some(p=>p.lesson_id===node.id&&p.completed_at)?'✓':index+1}</span>
          <div className="step-body" lang={contentLang(node.language)}><strong>{node.title}</strong>
            <small>{node.locked?t('Требуется допуск','Access required'):node.description}</small></div>
        </Link>)}</div></section>:null}
      {cards.length||!lessons.length?<div className="catalog-results"><ContentCards nodes={cards} locale={locale}/></div>:null}
    </>;
  }
  if(section==='attachments'&&(search.brand==='Kenwood'||search.brand==='Braun')){
    redirect('/academy/'+search.brand.toLowerCase()+'?group=attachments');
  }
  if(section==='offers')return <>
    <PageHead title={t('Акции','Offers')}/>
    <ContentCards nodes={catalog.filter(node=>node.kind==='post'&&node.data.postKind==='offer')} locale={locale}/>
  </>;
  if(section==='profile') return <><PageHead title={user.display_name}/>
    <div className="info-box"><h2>{t('Мой прогресс','My progress')}</h2><p>{t('Завершено уроков','Lessons completed')}: {progress.filter(p=>p.completed_at).length}</p>
      {progress.map(p=>{const node=nodes.find(n=>n.id===p.lesson_id);return node?<p key={p.lesson_id}><Link href={contentHref(node)}>{node.title} {p.completed_at?'✓':`· ${p.position_seconds} ${t('сек','sec')}`}</Link></p>:null;})}</div>
    <h2>{t('Избранное','Favorites')}</h2>
    {nodes.some(node=>favorites.includes(node.id))?<ContentCards nodes={nodes.filter(node=>favorites.includes(node.id))} locale={locale}/>:null}
    <ArticleCards items={builtinArticles(locale).filter(a=>articleFavorites.includes(a.slug))}
      locale={locale} favorites={{articles:articleFavorites,content:favorites}}/>
    {!articleFavorites.length&&!nodes.some(node=>favorites.includes(node.id))?
      <p className="empty">{t('Избранное пока пусто.','Your favorites are empty.')}</p>:null}
    <p className="info-box">{t('Сменить зарегистрированный браузер можно через поддержку JUICY.','Contact JUICY support to change your registered browser.')}</p></>;
  if(section==='more')redirect('/academy/learn');
  if(section==='club')redirect('/academy/contacts');
  if(section==='contacts') {
    const tokens=await pageTokens();
    const history=await withDb(async db=>supportHistory(db,await principal(db,tokens)));
    const bot=process.env.TELEGRAM_LOGIN_BOT_NAME;
    return <><PageHead title={t('Контакты','Contact')} description={t('Поддержка и вопросы о доступе.','Support and access questions.')}/>
      <section className="info-box"><h2>{t('Напишите команде','Write to the team')}</h2>
        <div className="support-history">{history.slice().reverse().map(message=><div className="support-message" key={String(message.id)}>
          <strong>{message.sender==='human'?t('Сотрудник JUICY','JUICY team'):t('Вы','You')}</strong><p>{String(message.body)}</p></div>)}</div>
        <SupportForm/>{bot?<p><a href={'https://t.me/'+encodeURIComponent(bot)} target="_blank" rel="noreferrer">{t('Уведомления и поддержка в Telegram','Notifications and support on Telegram')} →</a></p>:null}</section></>;
  }
  if(section==='events'){
    const events=await withDb(db=>eventsWithSeats(db,catalog.filter(node=>node.data.startsAt&&Date.parse(node.data.startsAt)>Date.now())));
    return <><PageHead title={t('Мастер-классы','Masterclasses')} description={t('Расписание встреч и свободные места.','Schedule and available seats.')}/>
      <EventCalendar base="/academy/events" items={events} month={search.month} canOpenDetails locale={locale}/>
      <section className="info-box"><h2>{t('Встреча в вашем городе','An event in your city')}</h2><CityInterestForm/></section></>;
  }
  const sections:Record<string,{title:string;kind?:string}>={
    recipes:{title:t('Рецепты','Recipes'),kind:'recipe'},attachments:{title:t('Насадки','Attachments'),kind:'attachment'},
    courses:{title:t('Курсы JUICY','JUICY courses'),kind:'course'},collections:{title:t('Кухни мира и тематические столы','World cuisines and themed menus'),kind:'collection'},
    materials:{title:t('Материалы','Resources'),kind:'material'},search:{title:t('Поиск по академии','Search the Academy')},news:{title:t('Новости JUICY','JUICY news'),kind:'post'},
  };
  if(!Object.hasOwn(sections,section))notFound();
  const {title,kind}=sections[section];
  const query=new URLSearchParams(Object.entries(search).filter((pair):pair is [string,string]=>typeof pair[1]==='string'));
  let items=filterContent(catalog.filter(node=>!kind||node.kind===kind),query);
  if(section==='recipes'&&search.attachment)items=items.filter(node=>links.some(link=>link.source_id===node.id&&nodes.some(item=>item.id===link.target_id&&item.slug===search.attachment)));
  const categories=[...new Set(nodes.filter(node=>node.kind==='recipe').map(node=>node.data.category).filter(Boolean))];
  const language=contentLanguages.find(code=>code===search.language)??'';
  return <><PageHead title={title}/>
    {section==='recipes'||section==='search'?<form className="filters" method="GET">
      <label><span className="sr-only">{t('Поиск','Search')}</span><input name="q" placeholder={t('Название рецепта, урока или насадки','Recipe, lesson or attachment name')} defaultValue={search.q}/></label>
      <label><span className="sr-only">{t('Язык материала','Content language')}</span><select name="language" defaultValue={language}>
        <option value="">{t('Все языки','All languages')}</option>
        <option value="RU">{t('Русский','Russian')}</option><option value="EN">{t('Английский','English')}</option>
      </select></label>
      {section==='recipes'?<>
        <label><span className="sr-only">{t('Насадка','Attachment')}</span><select name="attachment" defaultValue={search.attachment??''}>
          <option value="">{t('Все насадки','All attachments')}</option>{nodes.filter(node=>node.kind==='attachment').map(node=><option key={node.id} value={node.slug}>{node.title}</option>)}</select></label>
        <label><span className="sr-only">{t('Категория','Category')}</span><select name="category" defaultValue={search.category??''}>
          <option value="">{t('Все категории','All categories')}</option>{categories.map(category=><option key={category}>{category}</option>)}</select></label>
        <label><span className="sr-only">{t('Время приготовления','Cooking time')}</span><select name="duration" defaultValue={search.duration??''}>
          <option value="">{t('Любое время','Any time')}</option><option value="15">{t('До 15 минут','Up to 15 minutes')}</option>
          <option value="30">{t('До 30 минут','Up to 30 minutes')}</option><option value="60">{t('До часа','Up to an hour')}</option></select></label>
      </>:null}
      <button className="btn btn-dark">{t('Найти','Find')}</button>
    </form>:null}
    <ContentCards nodes={items} locale={locale}/>
    {section==='recipes'?<section className="section"><Link className="btn btn-outline" href="/academy/collections">{t('Кухни мира и тематические столы','World cuisines and themed menus')} →</Link></section>:null}
  </>;
}
