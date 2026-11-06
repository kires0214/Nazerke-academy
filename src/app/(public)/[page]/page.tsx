import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageHead, Photo } from '@/components/cards';
import { PublicArticles } from '@/components/public-content';
import { withDb } from '@/lib/db';
import { listContent } from '@/lib/content';
export default async function Page({params}:{params:Promise<{page:string}>}) {
  const {page}=await params;
  if(page==='about') return <section className="about"><div className="portrait-frame about-photo"><Photo name="nazerke-about.avif" alt="Назерке" priority/></div><div><PageHead title="Об академии" kicker="JUICY by Nazerke"/><p className="lead">Готовим с уверенностью и удовольствием.</p><p>JUICY — пространство уроков, рецептов и поддержки Назерке. Мы начинаем со знакомства с Kenwood, разбираемся с насадками и переходим к практике.</p><Link href="/login" className="btn btn-dark">Войти в академию</Link></div></section>;
  if(page==='articles') return <><PageHead title="Полезно знать" description="Открытые статьи о технике и кулинарных привычках."/><PublicArticles/></>;
  if(page==='events') {
    const events=process.env.DATABASE_URL?(await withDb(db=>listContent(db))).filter(n=>n.kind==='event'&&n.data.startsAt&&new Date(n.data.startsAt)>new Date()):[];
    return <><PageHead title="Мастер-классы" description="Живые встречи и совместная практика."/>{events.length?<div className="cards">{events.map(e=><article className="card card-body" key={e.id}><h2>{e.title}</h2><p>{e.data.city} · {new Date(e.data.startsAt!).toLocaleDateString('ru-RU',{timeZone:'Asia/Qyzylorda'})}</p><Link href="/login">Войти для записи →</Link></article>)}</div>:<p className="empty">О новых встречах сообщим здесь после подтверждения программы и даты.</p>}</>;
  }
  if(page==='contacts') return <><PageHead title="Мы рядом" description="Вопросы о доступе и обучении."/><div className="info-box"><p>Войдите в академию, чтобы написать команде в разделе JUICY Club.</p><p>Если браузер уже привязан, обратитесь к команде JUICY через знакомый канал поддержки для восстановления доступа.</p><Link className="btn btn-dark" href="/login">Войти</Link></div></>;
  if(page==='privacy') return <><PageHead title="Конфиденциальность"/><div className="info-box"><p>Для входа используются идентификатор Telegram и имя. Академия хранит статус доступа, привязку браузера, сессии, прогресс, избранное и сообщения поддержки. Данные используются для обучения, безопасности и ответа на обращения.</p><p>Видеопросмотр обслуживает Cloudflare Stream, вход и уведомления — Telegram. Уведомления включаются командой /start и отключаются командой /stop в боте.</p><p>Для удаления данных и восстановления доступа обратитесь в поддержку JUICY. До начала работы с реальными клиентами команда должна утвердить условия обработки персональных данных и сроки хранения.</p></div></>;
  if(page==='terms') return <><PageHead title="Правила доступа"/><div className="info-box"><p>Доступ подтверждается командой вручную. Учётная запись предназначена для одного человека и одного зарегистрированного браузера. Не передавайте cookies или доступ другим людям. Смена браузера требует сброса привязки службой поддержки.</p><p>Учебные материалы нельзя публиковать или передавать без разрешения правообладателя. Привязка браузера и временные ссылки ограничивают доступ, но не исключают запись экрана.</p></div></>;
  notFound();
}
