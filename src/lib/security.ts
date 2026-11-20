import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Db } from './db';
import { check } from './errors';

import { grants,learningTracks } from './catalog';
export { grants } from './catalog';
export type Grant = typeof grants[number];
export type Role = 'guest' | 'student' | 'admin' | 'techadmin';
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

export async function audit(db: Db, actor: string | null, operation: string, entity: string, metadata = {}) {
  await db.query('INSERT INTO audit_events(actor_id,operation,entity_id,metadata,actor_role) VALUES($1,$2,$3,$4,(SELECT role FROM users WHERE id=$1))',[actor,operation,entity,JSON.stringify(metadata)]);
}
export async function rateLimit(db: Db, key: string, limit: number, seconds = 60) {
  const bucket = Math.floor(Date.now()/1000/seconds);
  const { rows } = await db.query<{hits:number}>('INSERT INTO rate_limits(key,bucket,hits) VALUES($1,$2,1) ON CONFLICT(key,bucket) DO UPDATE SET hits=rate_limits.hits+1 RETURNING hits',[key,bucket]);
  check(rows[0].hits <= limit,429,'RATE_LIMITED');
}
export async function lockTelegramRegistration(db:Db,telegramId:string) {
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended('telegram-registration:'||$1,0))",[telegramId]);
}
export function hasGrant(p: Principal, grant: Grant) { return p.status === 'approved' && (p.role === 'techadmin' || p.role === 'admin' && p.grants.includes(grant)); }
export function isStudioRole(role: Role) { return role === 'admin' || role === 'techadmin'; }
export function requireGrant(p: Principal, grant: Grant) { check(hasGrant(p,grant),403,'PERMISSION_DENIED'); }
export function requireApproved(p: Principal) { check(p.status === 'approved',403,'APPROVAL_REQUIRED'); }
export function canLearn(p: Principal, audience: string,tracks:readonly string[]=learningTracks) {
  if (audience === 'public') return true;
  if (p.status !== 'approved') return false;
  if (p.role === 'techadmin') return true;
  return p.scopes.includes('academy') && (audience==='ambassador'?p.scopes.includes('ambassador'):
    audience==='academy'&&tracks.some(track=>p.scopes.includes(track)));
}

export async function principal(db: Db, tokens: Tokens, allowPending = false): Promise<Principal> {
  check(tokens.session && tokens.device,401,'LOGIN_REQUIRED');
  const { rows } = await db.query<{id:string;display_name:string;status:string;role:Role}>(`SELECT u.id,u.display_name,u.status,u.role FROM sessions s
    JOIN users u ON u.id=s.user_id JOIN devices d ON d.id=s.device_id AND d.user_id=u.id
    WHERE s.token_hash=$1 AND d.binding_hash=$2 AND s.revoked_at IS NULL AND d.revoked_at IS NULL AND s.expires_at>now()
    FOR SHARE OF u,s,d`,[hash(tokens.session),hash(tokens.device)]);
  check(rows[0],401,'SESSION_INVALID');
  check(!['blocked','archived','deleted'].includes(rows[0].status),403,'ACCOUNT_BLOCKED');
  if (!allowPending) check(rows[0].status === 'approved',403,'APPROVAL_REQUIRED');
  const { rows: permissions } = await db.query<{permission:string}>('SELECT permission FROM admin_grants WHERE user_id=$1',[rows[0].id]);
  const { rows: scopes } = await db.query<{scope:string}>('SELECT scope FROM access_entitlements WHERE user_id=$1',[rows[0].id]);
  return {...rows[0],grants:permissions.map(x=>x.permission),scopes:scopes.map(x=>x.scope)};
}

// Caller must use a database transaction; row lock serializes first-device races.
export async function createLogin(db: Db, telegramId: string, browserToken?: string) {
  const { rows: users } = await db.query<{id:string;status:string;role:Role}>('SELECT id,status,role FROM users WHERE telegram_id=$1 FOR UPDATE',[telegramId]);
  const user = users[0];
  check(user?.status === 'approved',403,'INVITE_REQUIRED');
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
  return { sessionToken, deviceToken, role: user.role };
}

export async function resetDevice(db: Db, actor: Principal, userId: string) {
  requireGrant(actor,'devices.reset');
  const { rows } = await db.query<{role:Role}>("SELECT role FROM users WHERE id=$1 AND status NOT IN ('archived','deleted') FOR UPDATE",[userId]);
  check(rows[0],404,'USER_NOT_FOUND');
  check(actor.role === 'techadmin' || !['admin','techadmin'].includes(rows[0].role),403,'STAFF_TECHADMIN_ONLY');
  await db.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[userId]);
  await db.query('UPDATE devices SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[userId]);
  await audit(db,actor.id,'device.reset',userId);
}
