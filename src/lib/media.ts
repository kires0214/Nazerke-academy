import type { Db } from './db';
import { check } from './errors';
import { deleteOwnedMuxMedia,type Fetcher } from './mux';
import { audit,requireGrant,type Principal } from './security';

export async function deleteMedia(db:Db,actor:Principal,id:string,fetcher?:Fetcher) {
  requireGrant(actor,'media.delete');
  const {rows:[media]}=await db.query<{id:string;provider:string;mux_upload_id:string|null;provider_id:string|null}>(
    'SELECT id,provider,mux_upload_id,provider_id FROM media WHERE id=$1 FOR UPDATE',[id]);
  check(media,404,'MEDIA_NOT_FOUND');
  const {rows:[links]}=await db.query<{linked:boolean}>('SELECT EXISTS(SELECT 1 FROM content_media WHERE media_id=$1) AS linked',[id]);
  check(!links.linked,409,'MEDIA_IN_USE');
  check(media.provider!=='stream',409,'LEGACY_MEDIA_DELETE_REQUIRED');
  if(media.provider==='mux')await deleteOwnedMuxMedia(media,fetcher);
  await db.query('DELETE FROM media WHERE id=$1',[id]);
  await audit(db,actor.id,'media.delete',id);
}
