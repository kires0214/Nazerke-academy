import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Db } from './db';
import { check } from './errors';

import { grants } from './catalog';
export { grants } from './catalog';
export type Grant = typeof grants[number];
export type Role = 'guest' | 'student' | 'ambassador' | 'admin' | 'techadmin';
export type Principal = { id: string; display_name: string; role: Role; status: string; grants: string[]; scopes: string[] };
export type Tokens = { session?: string; device?: string };
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('base64url');
export function downloadSignature(mediaId:string,sessionToken:string,expires:number) {
  const secret=process.env.TELEGRAM_BOT_TOKEN;
  check(secret&&secret.length>20,503,'DOWNLOAD_SIGNING_NOT_CONFIGURED');
  return createHmac('sha256',secret).update(`juicy-document-v1\n${mediaId}\n${hash(sessionToken)}\n${expires}`).digest('base64url');
}
export function verifyDownload(mediaId:string,sessionToken:string,expires:number,signature:string) {
  const now=Math.floor(Date.now()/1000);
  check(Number.isSafeInteger(expires)&&expires>now&&expires<=now+120&&equal(signature,downloadSignature(mediaId,sessionToken,expires)),403,'DOWNLOAD_LINK_EXPIRED');
}
export function equal(a: string, b: string) { const left=Buffer.from(a),right=Buffer.from(b);return left.length === right.length && timingSafeEqual(left,right); }

const loginSchema = z.object({
  id: z.string().regex(/^[1-9][0-9]{0,15}$/), first_name: z.string().min(1).max(120),
  last_name: z.string().max(120).optional(), username: z.string().max(100).optional(),
  photo_url: z.string().max(1000).optional(), auth_date: z.string().regex(/^\d{10}$/), hash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export function verifyTelegram(input: unknown, botToken: string, now = Math.floor(Date.now()/1000)) {
  const login = loginSchema.parse(input);
  check(botToken.length > 20, 503, 'TELEGRAM_NOT_CONFIGURED');
  const timestamp = Number(login.auth_date);
  check(timestamp <= now + 30 && now - timestamp <= 300, 401, 'TELEGRAM_EXPIRED');
  const canonical = Object.entries(login).filter(([key]) => key !== 'hash').sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('\n');
  const secret = createHash('sha256').update(botToken).digest();
  check(equal(createHmac('sha256',secret).update(canonical).digest('hex'),login.hash),401,'TELEGRAM_FORGED');
  return { telegramId: login.id, name: login.first_name, receipt: login.hash };
}

export async function audit(db: Db, actor: string | null, operation: string, entity: string, metadata = {}) {
  await db.query('INSERT INTO audit_events(actor_id,operation,entity_id,metadata) VALUES($1,$2,$3,$4)',[actor,operation,entity,JSON.stringify(metadata)]);
}
export async function rateLimit(db: Db, key: string, limit: number, seconds = 60) {
  const bucket = Math.floor(Date.now()/1000/seconds);
  const { rows } = await db.query<{hits:number}>('INSERT INTO rate_limits(key,bucket,hits) VALUES($1,$2,1) ON CONFLICT(key,bucket) DO UPDATE SET hits=rate_limits.hits+1 RETURNING hits',[key,bucket]);
  check(rows[0].hits <= limit,429,'RATE_LIMITED');
}
export function hasGrant(p: Principal, grant: Grant) { return p.status === 'approved' && (p.role === 'techadmin' || p.role === 'admin' && p.grants.includes(grant)); }
export function requireGrant(p: Principal, grant: Grant) { check(hasGrant(p,grant),403,'PERMISSION_DENIED'); }
export function requireApproved(p: Principal) { check(p.status === 'approved',403,'APPROVAL_REQUIRED'); }
export function canLearn(p: Principal, audience: string) {
  if (audience === 'public') return true;
  if (p.status !== 'approved') return false;
  if (p.role === 'techadmin') return true;
  return p.scopes.includes('academy') && (audience === 'academy' || p.role === 'ambassador' && p.scopes.includes('ambassador'));
}

export async function principal(db: Db, tokens: Tokens, allowPending = false): Promise<Principal> {
  check(tokens.session && tokens.device,401,'LOGIN_REQUIRED');
  const { rows } = await db.query<{id:string;display_name:string;status:string;role:Role}>(`SELECT u.id,u.display_name,u.status,u.role FROM sessions s
    JOIN users u ON u.id=s.user_id JOIN devices d ON d.id=s.device_id AND d.user_id=u.id
    WHERE s.token_hash=$1 AND d.binding_hash=$2 AND s.revoked_at IS NULL AND d.revoked_at IS NULL AND s.expires_at>now()
    FOR SHARE OF u,s,d`,[hash(tokens.session),hash(tokens.device)]);
  check(rows[0],401,'SESSION_INVALID');
  check(rows[0].status !== 'blocked',403,'ACCOUNT_BLOCKED');
  if (!allowPending) check(rows[0].status === 'approved',403,'APPROVAL_REQUIRED');
  const { rows: permissions } = await db.query<{permission:string}>('SELECT permission FROM admin_grants WHERE user_id=$1',[rows[0].id]);
  const { rows: scopes } = await db.query<{scope:string}>('SELECT scope FROM access_entitlements WHERE user_id=$1',[rows[0].id]);
  return {...rows[0],grants:permissions.map(x=>x.permission),scopes:scopes.map(x=>x.scope)};
}

// Caller must use a database transaction; row lock serializes first-device races.
export async function createLogin(db: Db, identity: ReturnType<typeof verifyTelegram>, browserToken?: string) {
  await rateLimit(db,'telegram:'+hash(identity.telegramId),10,300);
  const receipt = await db.query('INSERT INTO login_receipts(hash,expires_at) VALUES($1,now()+interval \'6 minutes\') ON CONFLICT DO NOTHING RETURNING hash',[identity.receipt]);
  check(receipt.rows.length,401,'TELEGRAM_REPLAYED');
  await db.query('INSERT INTO users(telegram_id,display_name) VALUES($1,$2) ON CONFLICT(telegram_id) DO NOTHING',[identity.telegramId,identity.name]);
  const { rows: users } = await db.query<{id:string;status:string}>('SELECT id,status FROM users WHERE telegram_id=$1 FOR UPDATE',[identity.telegramId]);
  const user = users[0]; check(user.status !== 'blocked',403,'ACCOUNT_BLOCKED');
  const { rows: devices } = await db.query<{id:string;binding_hash:string}>('SELECT id,binding_hash FROM devices WHERE user_id=$1 AND revoked_at IS NULL',[user.id]);
  const deviceToken = browserToken && /^[\w-]{43}$/.test(browserToken) ? browserToken : token();
  let device = devices[0];
  if (device) check(equal(device.binding_hash,hash(deviceToken)),409,'BROWSER_REGISTERED_CONTACT_SUPPORT');
  else {
    const { rows } = await db.query<{id:string;binding_hash:string}>('INSERT INTO devices(user_id,binding_hash) VALUES($1,$2) RETURNING id,binding_hash',[user.id,hash(deviceToken)]);
    device = rows[0];
    await audit(db,user.id,'device.register',device.id);
  }
  await db.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[user.id]);
  const sessionToken = token();
  await db.query('INSERT INTO sessions(user_id,device_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval \'7 days\')',[user.id,device.id,hash(sessionToken)]);
  await audit(db,user.id,'session.replace',user.id);
  return { sessionToken, deviceToken, status: user.status };
}

export async function resetDevice(db: Db, actor: Principal, userId: string) {
  requireGrant(actor,'devices.reset');
  const { rows } = await db.query<{role:Role}>('SELECT role FROM users WHERE id=$1 FOR UPDATE',[userId]);
  check(rows[0],404,'USER_NOT_FOUND');
  check(actor.role === 'techadmin' || !['admin','techadmin'].includes(rows[0].role),403,'STAFF_TECHADMIN_ONLY');
  await db.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[userId]);
  await db.query('UPDATE devices SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[userId]);
  await audit(db,actor.id,'device.reset',userId);
}
