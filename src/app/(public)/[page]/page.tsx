import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageHead, Photo } from '@/components/cards';
import { PublicArticles } from '@/components/public-content';
import { withDb } from '@/lib/db';
import { listContent } from '@/lib/content';
import { eventsWithSeats } from '@/lib/events';
import { publicPageUser } from '@/lib/pages';
import { EventCalendar } from '@/components/event-calendar';
import { siteLocale } from '@/lib/site-locale';
import { copy } from '@/lib/locale';
export default async function Page({params,searchParams}:{params:Promise<{page:string}>;searchParams:Promise<Record<string,unknown>>}) {
  const [{page},locale]=await Promise.all([params,siteLocale()]);
  const t=copy(locale);
  if(page==='about') return <section className="about"><div className="portrait-frame about-photo"><Photo name="nazerke-about.avif" alt={t('Назерке','Nazerke')} priority/></div><div><PageHead title={t('Об академии','About the Academy')} kicker="JUICY by Nazerke"/><p className="lead">{t('Готовим с уверенностью и удовольствием.','Cook with confidence and enjoy the process.')}</p><p>{t('JUICY — пространство уроков, рецептов и поддержки Назерке. Мы знакомимся с техникой и насадками, а затем переходим к практике.','JUICY is Nazerke’s home for lessons, recipes, and support. Get to know your appliances and attachments, then put them to work.')}</p><Link href="/login" className="btn btn-dark">{t('Войти в академию','Sign in to Academy')}</Link></div></section>;
  if(page==='articles') return <><PageHead title={t('Полезно знать','Good to know')} description={t('Открытые статьи о технике и кулинарных привычках.','Public articles about equipment and kitchen habits.')}/><PublicArticles locale={locale}/></>;
  if(page==='events') {
    const events=process.env.DATABASE_URL?await withDb(async db=>eventsWithSeats(db,(await listContent(db))
      .filter(node=>node.data.startsAt&&Date.parse(node.data.startsAt)>Date.now()))):[];
    return <><PageHead title={t('Мастер-классы','Masterclasses')} description={t('Живые встречи и совместная практика.','In-person events and hands-on practice.')}/>
      <EventCalendar locale={locale} base="/events" items={events} month={(await searchParams).month} canOpenDetails={(await publicPageUser())?.status==='approved'}/></>;
  }
  if(page==='contacts'){
    const user=await publicPageUser();
    const bot=process.env.TELEGRAM_LOGIN_BOT_NAME;
    return <><PageHead title={t('Контакты','Contact')} description={t('Вопросы о доступе и обучении.','Questions about access and lessons.')}/>
      <div className="info-box"><p>{t('Напишите команде JUICY в Telegram или через форму в Академии.','Contact the JUICY team on Telegram or through the Academy support form.')}</p>
        <div className="actions">
          {bot&&/^[A-Za-z0-9_]{5,32}$/.test(bot)?<a className="btn btn-dark" href={'https://t.me/'+bot} target="_blank" rel="noreferrer">Telegram ↗</a>:null}
          <Link className="btn btn-outline" href={user?.status==='approved'?'/academy/contacts':'/login'}>
            {user?.status==='approved'?t('Поддержка в Академии','Academy support'):t('Войти','Sign in')}</Link>
        </div>
      </div></>;
  }
  if(page==='privacy') return <><PageHead title={t('Конфиденциальность','Privacy')}/><div className="info-box"><p>{t('Для рассмотрения заявки команда JUICY получает указанные вами имя, фамилию, номер телефона и идентификатор Telegram. В заявке с сайта мы также просим указать магазин и номер заказа. Телефон, магазин и номер заказа удаляются из заявки после принятия решения. Для входа используется идентификатор Telegram и одноразовый код.','JUICY reviews the name, phone number, and Telegram ID that you provide. Applications from the website also include the store and order number. The phone number, store, and order number are removed after the decision. Sign-in uses your Telegram ID and a one-time code.')}</p><p>{t('Академия хранит статус доступа, привязку браузера, сессии, прогресс, избранное и сообщения поддержки. В журнале для уполномоченных сотрудников фиксируются посещения закрытых страниц и действия аккаунтов с указанием времени.','The Academy stores your access status, browser registration, sessions, progress, favorites, and support messages. Authorized staff can view a timestamped log of private page visits and account actions.')}</p><p>{t('Видеопросмотр обслуживает Mux, вход и уведомления — Telegram. Уведомления включаются командой /start и отключаются командой /stop в боте.','Mux provides video playback. Telegram handles sign-in and notifications. Use /start in the bot to enable notifications and /stop to disable them.')}</p><p>{t('Для удаления данных и восстановления доступа обратитесь в поддержку JUICY.','Contact JUICY support to delete your data or regain access.')}</p></div></>;
  if(page==='terms') return <><PageHead title={t('Правила доступа','Access rules')}/><div className="info-box"><p>{t('Доступ подтверждается командой вручную. Учётная запись предназначена для одного человека и одного зарегистрированного браузера. Не передавайте cookies или доступ другим людям. Смена браузера требует сброса привязки службой поддержки.','The team approves access manually. Each account is for one person and one registered browser. Keep your cookies and account access private. Contact support to register a different browser.')}</p><p>{t('Учебные материалы нельзя публиковать или передавать без разрешения правообладателя. Привязка браузера и временные ссылки ограничивают доступ, но не исключают запись экрана.','Publishing or sharing course materials requires permission from the rights holder. Browser registration and temporary links restrict access, although screen recording is still possible.')}</p></div></>;
  notFound();
}
