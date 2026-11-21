import { ContentCards,PageHead } from '@/components/cards';
import { listContent } from '@/lib/content';
import { withDb } from '@/lib/db';
import { copy } from '@/lib/locale';
import { siteLocale } from '@/lib/site-locale';

export default async function Page() {
  const [all,locale]=await Promise.all([process.env.DATABASE_URL?withDb(db=>listContent(db)):[],siteLocale()]);
  const t=copy(locale);
  return <><PageHead title={t('Акции','Offers')} kicker="JUICY by Nazerke"/>
    <ContentCards nodes={all.filter(node=>node.kind==='post'&&node.data.postKind==='offer')}
      linkFor={node=>'/offers/'+node.slug} locale={locale}/>
  </>;
}
