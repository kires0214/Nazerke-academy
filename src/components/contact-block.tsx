import Link from 'next/link';
import { copy,type SiteLocale } from '@/lib/locale';

export function ContactBlock({locale,academy=false}:{locale:SiteLocale;academy?:boolean}) {
  const t=copy(locale);
  const bot=process.env.TELEGRAM_LOGIN_BOT_NAME;
  return <section className="contacts-block" aria-labelledby="contacts-heading">
    <div><h2 id="contacts-heading">{t('Контакты','Contact')}</h2>
      <p>{t('Вопросы по доступу, материалам или встречам? Напишите команде JUICY.','Questions about access, materials or events? Get in touch with JUICY.')}</p></div>
    <div className="actions">
      <Link className="btn btn-dark" href={academy?'/academy/contacts':'/contacts'}>{t('Связаться с командой','Contact the team')} →</Link>
      {bot&&/^[A-Za-z0-9_]{5,32}$/.test(bot)?<a className="btn btn-outline" href={'https://t.me/'+bot} target="_blank" rel="noreferrer">Telegram ↗</a>:null}
    </div>
  </section>;
}
