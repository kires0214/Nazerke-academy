import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { updateAccount } from './accounts';
import type { Db } from './db';
import { check } from './errors';
import { baseUrl } from './http';
import { telegramSend } from './providers';
import { audit, createLogin, hash, rateLimit, requireGrant, type Principal } from './security';

const phone = z.string().regex(/^\+?[0-9]{7,15}$/);
export const loginCode = z.string().trim().regex(/^[A-Za-z0-9_-]{12}$/);
export const requestDecision = z.object({ action: z.enum(['invite', 'decline']) }).strict();
export const telegramContact = z.object({
  user_id: z.number().int().positive().optional(),
  first_name: z.string().max(120),
  last_name: z.string().max(120).optional(),
  phone_number: z.string().max(50),
});

export function configuredTelegramBot() {
  const bot = process.env.TELEGRAM_LOGIN_BOT_NAME;
  return bot && /^[A-Za-z0-9_]{5,32}$/.test(bot) && process.env.TELEGRAM_BOT_TOKEN &&
    (process.env.TELEGRAM_WEBHOOK_SECRET?.length ?? 0) >= 32 && process.env.DATABASE_URL &&
    process.env.APP_BASE_URL ? bot : undefined;
}

// Called only from the verified private-chat webhook.
export async function handleTelegramAccess(
  db: Db, telegramId: string, text: string | undefined, contact: z.infer<typeof telegramContact> | undefined,
  send = telegramSend,
) {
  const login = text === '/start login' || text === '/login';
  const join = text === '/start request' || text === '/request';
  if (!login && !join && !contact && text !== '/start') return false;

  const user = (await db.query<{ status: string }>('SELECT status FROM users WHERE telegram_id=$1', [telegramId])).rows[0];
  if (user?.status === 'blocked') {
    if (login || join || text === '/start') await send(telegramId, 'Доступ закрыт. Обратитесь к команде JUICY.');
    return true;
  }
  if (user?.status === 'approved' && (login || join)) {
    if (join) {
      await send(telegramId, 'У вас уже есть доступ. Отправьте /login, чтобы получить код входа.');
      return true;
    }
    await rateLimit(db, 'bot-login:' + hash(telegramId), 6, 300);
    await db.query('DELETE FROM telegram_login_codes WHERE expires_at<=now()');
    const code = randomBytes(9).toString('base64url');
    await db.query(`INSERT INTO telegram_login_codes (telegram_id,code_hash,expires_at) VALUES ($1,$2,now()+interval '5 minutes')
      ON CONFLICT (telegram_id) DO UPDATE SET code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at`, [telegramId, hash(code)]);
    await send(telegramId, 'Код входа в JUICY: ' + code + '\nВведите его на странице входа в течение 5 минут. Никому не передавайте код.');
    return true;
  }
  if (user?.status === 'approved') return !!contact;

  const existing = (await db.query<{ status: string }>('SELECT status FROM registration_requests WHERE telegram_id=$1', [telegramId])).rows[0];
  if (existing) {
    await send(telegramId, existing.status === 'requested'
      ? 'Заявка уже отправлена. Мы сообщим о решении здесь.'
      : 'Заявка рассмотрена. Вопросы о доступе можно задать команде JUICY.',
    undefined, { remove_keyboard: true });
    return true;
  }
  if (!contact) {
    const privacyUrl = baseUrl() + '/privacy';
    await send(telegramId, 'Академия открыта по приглашениям. Нажмите кнопку, чтобы отправить команде JUICY ваше имя и номер телефона для рассмотрения заявки. Обработка данных: ' + privacyUrl,
      undefined, { keyboard: [[{ text: 'Отправить имя и номер телефона', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true });
    return true;
  }

  const number = phone.safeParse(contact.phone_number.trim());
  if (String(contact.user_id) !== telegramId || !number.success) {
    await send(telegramId, 'Пожалуйста, отправьте свой контакт кнопкой «Отправить имя и номер телефона».');
    return true;
  }
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim().slice(0, 120);
  check(name, 400, 'INVALID_CONTACT');
  await db.query('INSERT INTO registration_requests(telegram_id,display_name,phone) VALUES($1,$2,$3) ON CONFLICT (telegram_id) DO NOTHING',
    [telegramId, name, number.data]);
  await send(telegramId, 'Заявка отправлена. Если команда одобрит доступ, приглашение придёт в этот чат.',
    undefined, { remove_keyboard: true });
  return true;
}

export async function redeemTelegramCode(db: Db, code: string, browserToken?: string) {
  const { rows } = await db.query<{ telegram_id: string }>(
    'DELETE FROM telegram_login_codes WHERE code_hash=$1 AND expires_at>now() RETURNING telegram_id', [hash(code)]);
  check(rows[0], 401, 'TELEGRAM_CODE_INVALID');
  return createLogin(db, String(rows[0].telegram_id), browserToken);
}

export async function pendingRegistrationRequests(db: Db, actor: Principal) {
  requireGrant(actor, 'students.read');
  return (await db.query<{ id: string; display_name: string; phone: string }>(
    "SELECT id,display_name,phone FROM registration_requests WHERE status='requested' ORDER BY created_at LIMIT 200")).rows;
}

export async function decideRegistration(db: Db, actor: Principal, id: string, action: 'invite' | 'decline') {
  requireGrant(actor, 'students.approve');
  const { rows } = await db.query<{ telegram_id: string; display_name: string; status: string }>(
    'SELECT telegram_id,display_name,status FROM registration_requests WHERE id=$1 FOR UPDATE', [id]);
  const request = rows[0];
  check(request, 404, 'REGISTRATION_NOT_FOUND');
  check(request.status === 'requested', 409, 'REGISTRATION_REVIEWED');
  if (action === 'invite') {
    const account = (await db.query<{ id: string }>("INSERT INTO users(telegram_id,display_name) VALUES($1,$2) ON CONFLICT (telegram_id) DO UPDATE SET telegram_id=EXCLUDED.telegram_id WHERE users.status='pending' AND users.role='student' RETURNING id",
      [request.telegram_id, request.display_name])).rows[0];
    check(account, 409, 'ACCOUNT_EXISTS');
    await updateAccount(db, actor, account.id, { action: 'approve' });
  }
  await db.query('UPDATE registration_requests SET status=$2,phone=NULL,reviewed_at=now() WHERE id=$1',
    [id, action === 'invite' ? 'invited' : 'declined']);
  await audit(db, actor.id, 'registration.' + action, id);
  const notice = action === 'invite'
    ? 'Команда JUICY пригласила вас в Академию. Откройте ' + baseUrl() + '/login и нажмите «Получить код в Telegram».'
    : 'Команда JUICY рассмотрела вашу заявку. Сейчас мы не можем открыть доступ.';
  await db.query('INSERT INTO notification_outbox(chat_id,body) VALUES($1,$2)', [request.telegram_id, notice]);
}
