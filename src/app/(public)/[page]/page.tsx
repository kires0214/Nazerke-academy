import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageHead, Photo } from '@/components/cards';
import { PublicArticles } from '@/components/public-content';
import { withDb } from '@/lib/db';
import { listContent } from '@/lib/content';
import { eventsWithSeats } from '@/lib/events';
import { publicPageUser } from '@/lib/pages';
import { EventCalendar } from '@/components/event-calendar';
export default async function Page({params,searchParams}:{params:Promise<{page:string}>;searchParams:Promise<Record<string,unknown>>}) {
  const {page}=await params;
  if(page==='about') return <section className="about"><div className="portrait-frame about-photo"><Photo name="nazerke-about.avif" alt="Назерке" priority/></div><div><PageHead title="Об академии" kicker="JUICY by Nazerke"/><p className="lead">Готовим с уверенностью и удовольствием.</p><p>JUICY — пространство уроков, рецептов и поддержки Назерке. Мы начинаем со знакомства с Kenwood, разбираемся с насадками и переходим к практике.</p><Link href="/login" className="btn btn-dark">Войти в академию</Link></div></section>;
  if(page==='articles') return <><PageHead title="Полезно знать" description="Открытые статьи о технике и кулинарных привычках."/><PublicArticles/></>;
  if(page==='events') {
    const events=process.env.DATABASE_URL?await withDb(async db=>eventsWithSeats(db,(await listContent(db))
      .filter(node=>node.data.startsAt&&Date.parse(node.data.startsAt)>Date.now()))):[];
    return <><PageHead title="Мастер-классы" description="Живые встречи и совместная практика."/>
      <EventCalendar base="/events" items={events} month={(await searchParams).month} canOpenDetails={(await publicPageUser())?.status==='approved'}/></>;
  }
  if(page==='contacts') return <><PageHead title="Мы рядом" description="Вопросы о доступе и обучении."/><div className="info-box"><p>Войдите в академию, чтобы написать команде в разделе JUICY Club.</p><p>Если браузер уже привязан, обратитесь к команде JUICY через знакомый канал поддержки для восстановления доступа.</p><Link className="btn btn-dark" href="/login">Войти</Link></div></>;
  if(page==='privacy') return <><PageHead title="Конфиденциальность"/><div className="info-box"><p>Для рассмотрения заявки команда JUICY получает имя, номер телефона и идентификатор Telegram. Номер телефона удаляется из заявки после решения. Для входа используется идентификатор Telegram и одноразовый код.</p><p>Академия хранит статус доступа, привязку браузера, сессии, прогресс, избранное и сообщения поддержки. В журнале для уполномоченных сотрудников фиксируются посещения закрытых страниц и действия аккаунтов с указанием времени.</p><p>Видеопросмотр обслуживает Mux, вход и уведомления — Telegram. Уведомления включаются командой /start и отключаются командой /stop в боте.</p><p>Для удаления данных и восстановления доступа обратитесь в поддержку JUICY.</p></div></>;
  if(page==='terms') return <><PageHead title="Правила доступа"/><div className="info-box"><p>Доступ подтверждается командой вручную. Учётная запись предназначена для одного человека и одного зарегистрированного браузера. Не передавайте cookies или доступ другим людям. Смена браузера требует сброса привязки службой поддержки.</p><p>Учебные материалы нельзя публиковать или передавать без разрешения правообладателя. Привязка браузера и временные ссылки ограничивают доступ, но не исключают запись экрана.</p></div></>;
  notFound();
}
