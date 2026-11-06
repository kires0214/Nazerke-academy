import type { NextRequest } from 'next/server';
import { handleApi, scheduleNotifications } from '@/lib/api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
async function handler(request:NextRequest,context:{params:Promise<{path:string[]}>}) {
  const response=await handleApi(request,(await context.params).path);
  if(request.method!=='GET'&&response.ok) scheduleNotifications();
  return response;
}
export {handler as GET,handler as POST,handler as PATCH};
