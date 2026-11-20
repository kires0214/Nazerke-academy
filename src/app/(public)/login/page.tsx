import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHead } from '@/components/cards';
import { TelegramCodeForm } from '@/components/actions';
import { configuredTelegramBot } from '@/lib/telegram-access';
import { publicPageUser } from '@/lib/pages';

export const dynamic='force-dynamic';

export default async function Page() {
  const user=await publicPageUser();
  if(user)redirect(user.status==='approved'?'/academy':'/access');
  const bot=configuredTelegramBot();
  return <><PageHead title="Добро пожаловать в JUICY" description="Доступ в Академию открывается по приглашению."/>
    {bot?<section className="info-box login-box">
      <h2>У меня есть приглашение</h2>
      <p>Получите код у бота и введите его здесь.</p>
      <a className="btn btn-outline" href={`https://t.me/${bot}?start=login`} target="_blank" rel="noopener noreferrer">Получить код в Telegram</a>
      <TelegramCodeForm/>
      <p>Аккаунт привязывается к одному браузеру. Для смены браузера обратитесь в поддержку.</p>
      <h2>Запросить приглашение</h2>
      <p>Поделитесь именем и номером телефона в боте. Команда JUICY рассмотрит заявку и ответит в Telegram.</p>
      <a className="btn btn-outline" href={`https://t.me/${bot}?start=request`} target="_blank" rel="noopener noreferrer">Запросить приглашение в Telegram</a>
    </section>:<p className="info-box" role="status">Вход и заявки будут доступны после подключения бота.</p>}
    <p><Link href="/terms">Правила доступа</Link> и <Link href="/privacy">обработка данных</Link>.</p>
  </>;
}
