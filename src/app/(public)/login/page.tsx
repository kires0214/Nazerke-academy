import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHead } from '@/components/cards';
import { TelegramCodeForm } from '@/components/actions';
import { configuredTelegramBot } from '@/lib/telegram-access';
import { publicPageUser } from '@/lib/pages';
import { siteCopy } from '@/lib/site-locale';

export const dynamic='force-dynamic';

export default async function Page() {
  const [user,t]=await Promise.all([publicPageUser(),siteCopy()]);
  if(user)redirect(user.status==='approved'?'/academy':'/access');
  const bot=configuredTelegramBot();
  return <><PageHead title={t('Добро пожаловать в JUICY','Welcome to JUICY')} description={t('Доступ в Академию открывается по приглашению.','Access to the Academy is by invitation.')}/>
    {bot?<section className="info-box login-box">
      <h2>{t('Войти в Академию','Sign in to the Academy')}</h2>
      <p>{t('Получите код у бота и введите его здесь.','Get a code from the bot and enter it here.')}</p>
      <a className="btn btn-outline" href={`https://t.me/${bot}?start=login`} target="_blank" rel="noopener noreferrer">{t('Получить код в Telegram','Get a code in Telegram')}</a>
      <TelegramCodeForm/>
      <p>{t('Аккаунт привязывается к одному браузеру. Для смены браузера обратитесь в поддержку.','Your account is registered to one browser. Contact support to change it.')}</p>
      <h2>{t('Запросить приглашение','Request an invitation')}</h2>
      <p>{t('Поделитесь своим контактом Telegram и укажите имя, фамилию, магазин и номер заказа. Команда JUICY ответит в Telegram.','Share your Telegram contact and enter your first and last name, store and order number. JUICY will reply on Telegram.')}</p>
      <p>{t('Если команда прислала вам ссылку-приглашение, откройте её в Telegram. Для такой заявки достаточно контакта, имени и фамилии.','If you received an invitation link from JUICY, open it in Telegram and share your contact, first name and last name.')}</p>
      <a className="btn btn-outline" href={`https://t.me/${bot}?start=request`} target="_blank" rel="noopener noreferrer">{t('Запросить приглашение в Telegram','Request an invitation in Telegram')}</a>
    </section>:<p className="info-box" role="status">{t('Вход и заявки будут доступны после подключения бота.','Sign-in and invitations will be available once the bot is connected.')}</p>}
    <p><Link href="/terms">{t('Правила доступа','Access rules')}</Link> {t('и','and')} <Link href="/privacy">{t('обработка данных','privacy')}</Link>.</p>
  </>;
}
