import Link from 'next/link';
import { cookies } from 'next/headers';
import { PageHead } from '@/components/cards';
import { TelegramWidget } from '@/components/actions';
import { baseUrl,cookieNames } from '@/lib/http';
export default async function Page({searchParams}:{searchParams:Promise<{state?:string}>}) {
  const {state}=await searchParams,jar=await cookies();
  const configured=!!(process.env.TELEGRAM_BOT_TOKEN&&process.env.TELEGRAM_LOGIN_BOT_NAME&&process.env.DATABASE_URL&&process.env.APP_BASE_URL);
  const validState=state&&/^[\w-]{43}$/.test(state)&&jar.get(cookieNames().state)?.value===state;
  return <><PageHead title="Добро пожаловать в JUICY" description="Войдите через Telegram. Новый аккаунт ожидает ручного подтверждения команды."/><section className="info-box login-box">
    {configured?(validState?<TelegramWidget bot={process.env.TELEGRAM_LOGIN_BOT_NAME!} authUrl={baseUrl()+'/api/auth/telegram?state='+state}/>:<Link className="btn btn-dark" href="/api/auth/start">Продолжить с Telegram</Link>):<p role="status">Вход скоро откроется. Подключение сервиса ещё не завершено.</p>}
    <p>Вход привязывает аккаунт к одному браузеру. Для смены браузера обратитесь в поддержку.</p><p>Продолжая, вы принимаете <Link href="/terms">правила доступа</Link> и знакомитесь с <Link href="/privacy">обработкой данных</Link>.</p></section></>;
}
