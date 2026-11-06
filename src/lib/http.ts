import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError, check } from './errors';
import type { Tokens } from './security';
export const cookieNames=() => process.env.NODE_ENV==='production' ? {session:'__Host-juicy_session',device:'__Host-juicy_device',state:'__Host-juicy_login_state'} : {session:'juicy_session',device:'juicy_device',state:'juicy_login_state'};
export function baseUrl() {
  check(process.env.APP_BASE_URL,503,'APP_BASE_URL_REQUIRED');
  const url=new URL(process.env.APP_BASE_URL);
  check(url.protocol==='https:' || process.env.NODE_ENV!=='production' && ['localhost','127.0.0.1'].includes(url.hostname),503,'HTTPS_REQUIRED');
  return url.origin;
}
export function requestTokens(req:NextRequest):Tokens { const names=cookieNames(); return {session:req.cookies.get(names.session)?.value,device:req.cookies.get(names.device)?.value}; }
export function cookiesForLogin(response:NextResponse,session:string,device:string) {
  const names=cookieNames(), options={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/'};
  response.cookies.set(names.session,session,{...options,maxAge:7*86400});
  response.cookies.set(names.device,device,{...options,maxAge:365*86400});
  response.cookies.set(names.state,'',{...options,maxAge:0});
}
export function sameOrigin(req:NextRequest) {
  check(req.headers.get('origin')===baseUrl(),403,'ORIGIN_DENIED');
  check(!['cross-site','none'].includes(req.headers.get('sec-fetch-site')??''),403,'CSRF_DENIED');
}
export async function jsonBody(req:NextRequest) {
  check(req.headers.get('content-type')?.startsWith('application/json'),415,'JSON_REQUIRED');
  const text=await limitedBody(req,200000); try { return JSON.parse(text); } catch { throw new AppError(400,'INVALID_JSON'); }
}
export async function limitedBody(req:NextRequest,max:number) {
  return (await limitedBytes(req,max)).toString('utf8');
}
export async function limitedBytes(req:NextRequest,max:number) {
  check(Number(req.headers.get('content-length')??0)<=max,413,'BODY_TOO_LARGE');
  const reader=req.body?.getReader(); check(reader,400,'BODY_REQUIRED'); const parts:Uint8Array[]=[]; let size=0;
  try { while(true) { const part=await reader.read(); if(part.done) break; size+=part.value.length; check(size<=max,413,'BODY_TOO_LARGE'); parts.push(part.value); } }
  finally { await reader.cancel(); }
  return Buffer.concat(parts);
}
export function apiResponse(value:unknown,status=200) { return NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}}); }
export function errorResponse(error:unknown) {
  if(error instanceof AppError) return apiResponse({error:error.code},error.status);
  if(error instanceof ZodError) return apiResponse({error:'INVALID_INPUT'},400);
  const code=(error as {code?:string})?.code;
  if(code==='23505') return apiResponse({error:'ALREADY_EXISTS'},409);
  if(code==='23503') return apiResponse({error:'REFERENCE_NOT_FOUND'},400);
  console.error('JUICY request failed',{category:code??'internal'}); // No body, token, query, identity or provider error text.
  return apiResponse({error:'SERVICE_UNAVAILABLE'},503);
}
