import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { studentTracksSchema,updateAccount } from './accounts';
import type { Db } from './db';
import { check } from './errors';
import { baseUrl } from './http';
import { telegramSend } from './providers';
import { audit, createLogin, grants, hash, lockTelegramRegistration, rateLimit, requireGrant, type Principal } from './security';
import { orderSourceLabels, type InviteMode } from './catalog';

const phone = z.string().regex(/^\+?[0-9]{7,15}$/);
const fullName=z.string().min(3).max(120).regex(/^\p{L}[\p{L}\p{M}'’.-]*(?: \p{L}[\p{L}\p{M}'’.-]*)+$/u);
const orderNumber=z.string().min(1).max(80).regex(/^[\p{L}\p{Nd}]+$/u);
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

const inviteStart = /^\/start invite_(multi_)?([A-Za-z0-9_-]{32})$/;
const activeInvite = 'used_at IS NULL AND revoked_at IS NULL AND expires_at>now()';
export const registrationInviteInput=z.object({mode:z.enum(['single','multi']).default('single')}).strict();

export async function createRegistrationInvite(db:Db, actor:Principal, mode:InviteMode) {
  requireGrant(actor,'students.approve');
  const bot=configuredTelegramBot();
  check(bot,503,'TELEGRAM_NOT_CONFIGURED');
  const token=randomBytes(24).toString('base64url');
  const {rows:[invite]}=await db.query<{id:string;expires_at:string}>(
    'INSERT INTO registration_invites(token_hash,created_by,mode) VALUES($1,$2,$3) RETURNING id,expires_at',[hash(token),actor.id,mode]);
  await audit(db,actor.id,'registration.link.create',invite.id,{mode});
  const prefix=mode==='multi'?'invite_multi_':'invite_';
  return {id:invite.id,expiresAt:invite.expires_at,url:`https://t.me/${bot}?start=${prefix}${token}`};
}

export async function registrationInvites(db:Db, actor:Principal) {
  requireGrant(actor,'students.approve');
  return (await db.query<{id:string;mode:InviteMode;created_at:string;expires_at:string;status:'active'|'used'|'revoked'|'expired'}>(`
    SELECT id,mode,created_at,expires_at,
      CASE WHEN used_at IS NOT NULL THEN 'used' WHEN revoked_at IS NOT NULL THEN 'revoked'
        WHEN expires_at<=now() THEN 'expired' ELSE 'active' END AS status
    FROM registration_invites ORDER BY (${activeInvite}) DESC,created_at DESC LIMIT 100`)).rows;
}

export async function revokeRegistrationInvite(db:Db, actor:Principal,id:string) {
  requireGrant(actor,'students.approve');
  const {rows}=await db.query(`UPDATE registration_invites SET revoked_at=now()
    WHERE id=$1 AND ${activeInvite} RETURNING id`,[id]);
  check(rows[0],409,'REGISTRATION_LINK_INACTIVE');
  await audit(db,actor.id,'registration.link.revoke',id);
}

// Called only from the verified private-chat webhook.
export async function handleTelegramAccess(
  db: Db, telegramId: string, text: string | undefined, contact: z.infer<typeof telegramContact> | undefined,
  send = telegramSend,
) {
  const login = text === '/start login' || text === '/login';
  const join = text === '/start request' || text === '/request';
  const openingInvite=!!text?.startsWith('/start invite_');
  if(!contact&&!text)return false;

  await lockTelegramRegistration(db,telegramId);
  const user = (await db.query<{ status: string }>('SELECT status FROM users WHERE telegram_id=$1 FOR SHARE', [telegramId])).rows[0];
  if (user?.status === 'blocked'||user?.status==='archived') {
    if (login || join || openingInvite || text === '/start'||contact) await send(telegramId, 'Доступ приостановлен. Обратитесь к команде JUICY.',undefined,{remove_keyboard:true});
    return true;
  }
  if (user?.status === 'approved' && (login || join || openingInvite)) {
    if (!login) {
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

  await db.query('DELETE FROM telegram_registration_drafts WHERE expires_at<=now()');
  const existing = (await db.query<{status:string;invite_id:string|null;order_source:string|null}>(
    'SELECT status,invite_id,order_source FROM registration_requests WHERE telegram_id=$1',[telegramId])).rows[0];
  if (existing && (existing.status!=='requested'||existing.invite_id||existing.order_source)) {
    await send(telegramId, existing.status === 'requested'
      ? 'Заявка уже отправлена. Мы сообщим о решении здесь.'
      : 'Заявка рассмотрена. Вопросы о доступе можно задать команде JUICY.',
    undefined, { remove_keyboard: true });
    return true;
  }
  const clearInvite=()=>db.query('DELETE FROM telegram_registration_invite_drafts WHERE telegram_id=$1',[telegramId]);
  if(text==='/cancel'){
    await db.query('DELETE FROM telegram_registration_drafts WHERE telegram_id=$1',[telegramId]);
    await clearInvite();
    await send(telegramId,'Заполнение отменено. Откройте свою ссылку-приглашение или отправьте /request для заявки с заказом.',undefined,{remove_keyboard:true});
    return true;
  }
  if(join)await clearInvite();
  const invalidInvite=()=>send(telegramId,'Ссылка недействительна, использована или срок её действия истёк. Попросите новую ссылку у команды JUICY или отправьте /request для заявки с заказом.',undefined,{remove_keyboard:true});
  if(openingInvite){
    const match=text?.match(inviteStart);
    const invite=match&&(await db.query<{id:string}>(`SELECT id FROM registration_invites WHERE token_hash=$1 AND mode=$2 AND ${activeInvite}`,
      [hash(match[2]),match[1]?'multi':'single'])).rows[0];
    if(!invite){await invalidInvite();return true;}
    await db.query(`INSERT INTO telegram_registration_invite_drafts(telegram_id,invite_id) VALUES($1,$2)
      ON CONFLICT(telegram_id) DO UPDATE SET invite_id=EXCLUDED.invite_id`,[telegramId,invite.id]);
  }
  const inviteDraft=(await db.query<{invite_id:string;mode:InviteMode;active:boolean}>(`SELECT d.invite_id,i.mode,(${activeInvite}) AS active
    FROM telegram_registration_invite_drafts d JOIN registration_invites i ON i.id=d.invite_id WHERE d.telegram_id=$1`,[telegramId])).rows[0];
  if(inviteDraft&&!inviteDraft.active){
    await clearInvite();
    await invalidInvite();
    return true;
  }

  const askPhone=async(typed=false)=>{
    const origin=baseUrl();
    const intro=typed?'Номер в тексте не подтверждает контакт.':'Академия открыта по приглашениям.';
    const steps=inviteDraft?'имя и фамилию':'имя, фамилию, магазин и номер заказа';
    await send(telegramId, intro+' Нажмите «Поделиться номером телефона» и подтвердите отправку своего контакта. Если открыта обычная клавиатура, нажмите значок из четырёх точек рядом с полем сообщения. Затем бот спросит '+steps+'. Обработка данных: '+origin+'/privacy',
      undefined, {keyboard:[[{text:'Поделиться номером телефона',request_contact:true}]],resize_keyboard:true,one_time_keyboard:false,is_persistent:true});
    if(origin.startsWith('https:')){
      try{
        await send(telegramId,'Можно также подтвердить номер кнопкой прямо под этим сообщением.',undefined,
          {inline_keyboard:[[{text:'Поделиться номером телефона',web_app:{url:origin+'/telegram/contact'}}]]});
      }catch{
        // The native contact keyboard was already sent.
        console.warn('JUICY Telegram inline contact button could not be sent');
      }
    }
  };
  const askName=()=>send(telegramId,'Введите ваше имя и фамилию одним сообщением.',undefined,{remove_keyboard:true});
  const askSource=()=>send(telegramId,'Где оформлен заказ? Выберите магазин.',undefined,
    {keyboard:[Object.values(orderSourceLabels).map(text=>({text}))],resize_keyboard:true,one_time_keyboard:true});
  const askOrder=()=>send(telegramId,'Введите номер заказа из подтверждения покупки. Только буквы и цифры, без пробелов и знаков. Например: AB12345.',undefined,{remove_keyboard:true});
  const submit=async(name:string,number:string,source:keyof typeof orderSourceLabels|null=null,order:string|null=null)=>{
    if(inviteDraft){
      const sql=inviteDraft.mode==='multi'
        ?`SELECT id FROM registration_invites WHERE id=$1 AND ${activeInvite} FOR SHARE`
        :`UPDATE registration_invites SET used_at=now() WHERE id=$1 AND ${activeInvite} RETURNING id`;
      const {rows}=await db.query(sql,[inviteDraft.invite_id]);
      if(!rows.length){
        await clearInvite();
        await invalidInvite();
        return true;
      }
      await audit(db,null,'registration.link.use',inviteDraft.invite_id);
    }
    await db.query(`INSERT INTO registration_requests(telegram_id,display_name,phone,order_source,order_number,invite_id)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (telegram_id) DO UPDATE SET display_name=EXCLUDED.display_name,
      phone=EXCLUDED.phone,order_source=EXCLUDED.order_source,order_number=EXCLUDED.order_number,invite_id=EXCLUDED.invite_id
      WHERE registration_requests.status='requested' AND registration_requests.invite_id IS NULL AND registration_requests.order_source IS NULL`,
      [telegramId,name,number,source,order,inviteDraft?.invite_id??null]);
    await db.query('DELETE FROM telegram_registration_drafts WHERE telegram_id=$1',[telegramId]);
    if(inviteDraft)await clearInvite();
    await send(telegramId, 'Заявка отправлена. Если команда одобрит доступ, приглашение придёт в этот чат.',undefined,{remove_keyboard:true});
    return true;
  };
  if(contact){
    const number=phone.safeParse(contact.phone_number.replace(/[\s().-]/g,''));
    if(String(contact.user_id)!==telegramId||!number.success){await askPhone();return true;}
    await db.query(`INSERT INTO telegram_registration_drafts(telegram_id,phone,expires_at) VALUES($1,$2,now()+interval '30 minutes')
      ON CONFLICT(telegram_id) DO UPDATE SET phone=EXCLUDED.phone,display_name=NULL,order_source=NULL,expires_at=EXCLUDED.expires_at`,[telegramId,number.data]);
    await askName();
    return true;
  }
  const draft=(await db.query<{phone:string;display_name:string|null;order_source:keyof typeof orderSourceLabels|null}>(
    'SELECT phone,display_name,order_source FROM telegram_registration_drafts WHERE telegram_id=$1',[telegramId])).rows[0];
  const resume=login||join||openingInvite||text==='/start';
  if(!draft){
    if(resume||text&&!text.startsWith('/')){await askPhone(!resume);return true;}
    return false;
  }
  if(inviteDraft&&draft.display_name)return submit(draft.display_name,draft.phone);
  if(resume){
    if(!draft.display_name)await askName();
    else if(!draft.order_source)await askSource();
    else await askOrder();
    return true;
  }
  const value=text?.trim().replace(/\s+/g,' ')??'';
  if(!draft.display_name){
    const name=fullName.safeParse(value);
    if(!name.success){await askName();return true;}
    if(inviteDraft)return submit(name.data,draft.phone);
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
  return submit(draft.display_name,draft.phone,draft.order_source,order.data);
}

export async function redeemTelegramCode(db: Db, code: string, browserToken?: string) {
  const codeHash=hash(code);
  // Lock the account before its code, the same order used by account lifecycle changes.
  await db.query('SELECT id FROM users WHERE telegram_id=(SELECT telegram_id FROM telegram_login_codes WHERE code_hash=$1 AND expires_at>now()) FOR UPDATE',[codeHash]);
  const { rows } = await db.query<{ telegram_id: string }>(
    'DELETE FROM telegram_login_codes WHERE code_hash=$1 AND expires_at>now() RETURNING telegram_id', [codeHash]);
  check(rows[0], 401, 'TELEGRAM_CODE_INVALID');
  return createLogin(db, String(rows[0].telegram_id), browserToken);
}

export async function pendingRegistrationRequests(db: Db, actor: Principal) {
  requireGrant(actor, 'students.read');
  return (await db.query<{ id: string; display_name: string; phone: string;order_source:keyof typeof orderSourceLabels|null;order_number:string|null;invite_id:string|null }>(
    "SELECT id,display_name,phone,order_source,order_number,invite_id FROM registration_requests WHERE status='requested' ORDER BY created_at LIMIT 200")).rows;
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
  const identity=(await db.query<{telegram_id:string}>('SELECT telegram_id FROM registration_requests WHERE id=$1',[id])).rows[0];
  check(identity,404,'REGISTRATION_NOT_FOUND');
  await lockTelegramRegistration(db,String(identity.telegram_id));
  const { rows } = await db.query<{telegram_id:string;display_name:string;status:string;invite_id:string|null;order_source:string|null}>(
    'SELECT telegram_id,display_name,status,invite_id,order_source FROM registration_requests WHERE id=$1 FOR UPDATE', [id]);
  const request = rows[0];
  check(request, 404, 'REGISTRATION_NOT_FOUND');
  check(request.status === 'requested', 409, 'REGISTRATION_REVIEWED');
  if (action === 'invite') {
    check(request.invite_id||request.order_source,409,'REGISTRATION_ORDER_REQUIRED');
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
