import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { studentTracksSchema,updateAccount } from './accounts';
import type { Db } from './db';
import { check } from './errors';
import { baseUrl } from './http';
import { telegramSend } from './providers';
import { audit, createLogin, grants, hash, rateLimit, requireGrant, type Principal } from './security';
import { orderSourceLabels } from './catalog';

const phone = z.string().regex(/^\+?[0-9]{7,15}$/);
const fullName=z.string().min(3).max(120).regex(/^\p{L}[\p{L}\p{M}'’.-]*(?: \p{L}[\p{L}\p{M}'’.-]*)+$/u);
const orderNumber=z.string().min(1).max(80).regex(/^[\p{L}\p{N}#№][\p{L}\p{N} /._#№-]*$/u)
  .refine(value=>/[\p{L}\p{N}]/u.test(value));
const orderSources:Record<string,keyof typeof orderSourceLabels>={
  kaspi:'kaspi',каспи:'kaspi',kenwood:'kenwood',кенвуд:'kenwood','сайт kenwood':'kenwood',
  braun:'braun',браун:'braun','сайт braun':'braun',
};
export const loginCode = z.string().trim().regex(/^[A-Za-z0-9_-]{12}$/);
export const requestDecision = z.discriminatedUnion('action',[
  z.object({action:z.literal('invite'),role:z.enum(['student','admin']).default('student'),
    grants:z.array(z.enum(grants)).max(grants.length).default([]),tracks:studentTracksSchema.optional()}).strict(),
  z.object({action:z.literal('decline')}).strict(),
]);
export const telegramContact = z.object({
  user_id: z.number().int().positive().optional(),
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
  if(!contact&&!text)return false;

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

  await db.query("SELECT pg_advisory_xact_lock(hashtextextended('telegram-registration:'||$1,0))",[telegramId]);
  await db.query('DELETE FROM telegram_registration_drafts WHERE expires_at<=now()');
  const existing = (await db.query<{ status: string }>('SELECT status FROM registration_requests WHERE telegram_id=$1', [telegramId])).rows[0];
  if (existing) {
    if(!login&&!join&&!contact&&text!=='/start')return true;
    await send(telegramId, existing.status === 'requested'
      ? 'Заявка уже отправлена. Мы сообщим о решении здесь.'
      : 'Заявка рассмотрена. Вопросы о доступе можно задать команде JUICY.',
    undefined, { remove_keyboard: true });
    return true;
  }
  const askPhone=async()=>{
    const privacyUrl = baseUrl() + '/privacy';
    await send(telegramId, 'Академия открыта по приглашениям. Отправьте свой номер телефона. Затем введите имя, фамилию и данные заказа. Обработка данных: ' + privacyUrl,
      undefined, {keyboard:[[{text:'Поделиться номером телефона',request_contact:true}]],resize_keyboard:true,one_time_keyboard:true});
  };
  const askName=()=>send(telegramId,'Введите ваше имя и фамилию одним сообщением.',undefined,{remove_keyboard:true});
  const askSource=()=>send(telegramId,'Где оформлен заказ? Выберите магазин.',undefined,
    {keyboard:[Object.values(orderSourceLabels).map(text=>({text}))],resize_keyboard:true,one_time_keyboard:true});
  const askOrder=()=>send(telegramId,'Введите номер заказа из подтверждения покупки.',undefined,{remove_keyboard:true});
  if(text==='/cancel'){
    await db.query('DELETE FROM telegram_registration_drafts WHERE telegram_id=$1',[telegramId]);
    await send(telegramId,'Заполнение отменено. Чтобы начать снова, отправьте /request.',undefined,{remove_keyboard:true});
    return true;
  }
  if(contact){
    const number=phone.safeParse(contact.phone_number.trim());
    if(String(contact.user_id)!==telegramId||!number.success){await askPhone();return true;}
    await db.query(`INSERT INTO telegram_registration_drafts(telegram_id,phone,expires_at) VALUES($1,$2,now()+interval '30 minutes')
      ON CONFLICT(telegram_id) DO UPDATE SET phone=EXCLUDED.phone,display_name=NULL,order_source=NULL,expires_at=EXCLUDED.expires_at`,[telegramId,number.data]);
    await askName();
    return true;
  }
  const draft=(await db.query<{phone:string;display_name:string|null;order_source:keyof typeof orderSourceLabels|null}>(
    'SELECT phone,display_name,order_source FROM telegram_registration_drafts WHERE telegram_id=$1',[telegramId])).rows[0];
  if(!draft){
    if(login||join||text==='/start'){await askPhone();return true;}
    return false;
  }
  if(login||join||text==='/start'){
    if(!draft.display_name)await askName();
    else if(!draft.order_source)await askSource();
    else await askOrder();
    return true;
  }
  const value=text?.trim().replace(/\s+/g,' ')??'';
  if(!draft.display_name){
    const name=fullName.safeParse(value);
    if(!name.success){await askName();return true;}
    await db.query("UPDATE telegram_registration_drafts SET display_name=$2,expires_at=now()+interval '30 minutes' WHERE telegram_id=$1",[telegramId,name.data]);
    await askSource();
    return true;
  }
  if(!draft.order_source){
    const source=Object.hasOwn(orderSources,value.toLocaleLowerCase('ru'))?orderSources[value.toLocaleLowerCase('ru')]:undefined;
    if(!source){await askSource();return true;}
    await db.query("UPDATE telegram_registration_drafts SET order_source=$2,expires_at=now()+interval '30 minutes' WHERE telegram_id=$1",[telegramId,source]);
    await askOrder();
    return true;
  }
  const order=orderNumber.safeParse(value);
  if(!order.success){await askOrder();return true;}
  await db.query('INSERT INTO registration_requests(telegram_id,display_name,phone,order_source,order_number) VALUES($1,$2,$3,$4,$5) ON CONFLICT (telegram_id) DO NOTHING',
    [telegramId,draft.display_name,draft.phone,draft.order_source,order.data]);
  await db.query('DELETE FROM telegram_registration_drafts WHERE telegram_id=$1',[telegramId]);
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
  return (await db.query<{ id: string; display_name: string; phone: string;order_source:keyof typeof orderSourceLabels|null;order_number:string|null }>(
    "SELECT id,display_name,phone,order_source,order_number FROM registration_requests WHERE status='requested' ORDER BY created_at LIMIT 200")).rows;
}

export async function decideRegistration(db: Db, actor: Principal, id: string, decision:z.infer<typeof requestDecision>) {
  requireGrant(actor, 'students.approve');
  const {action}=decision;
  if(action==='invite') {
    check(decision.role==='admin'||decision.grants.length===0,400,'GRANTS_REQUIRE_ADMIN');
    if(decision.role==='admin')check(actor.role==='techadmin',403,'TECHADMIN_ONLY');
    if(decision.tracks!==undefined){
      check(decision.role==='student',400,'TRACKS_REQUIRE_STUDENT');
      requireGrant(actor,'students.tracks');
    }
  }
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
    if(decision.role==='admin')await updateAccount(db,actor,account.id,{action:'staff',role:'admin',grants:decision.grants});
    if(decision.tracks!==undefined)await updateAccount(db,actor,account.id,{action:'tracks',tracks:decision.tracks});
  }
  await db.query('UPDATE registration_requests SET status=$2,phone=NULL,order_source=NULL,order_number=NULL,reviewed_at=now() WHERE id=$1',
    [id, action === 'invite' ? 'invited' : 'declined']);
  await audit(db, actor.id, 'registration.' + action, id,action==='invite'?{role:decision.role,tracks:decision.tracks}:{});
  const notice = action === 'invite'
    ? 'Команда JUICY пригласила вас в Академию. Откройте ' + baseUrl() + '/login и нажмите «Получить код в Telegram».'
    : 'Команда JUICY рассмотрела вашу заявку. Сейчас мы не можем открыть доступ.';
  await db.query('INSERT INTO notification_outbox(chat_id,body) VALUES($1,$2)', [request.telegram_id, notice]);
}
