import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHead,Photo,RichText } from '@/components/cards';
import { listContent } from '@/lib/content';
import { withDb } from '@/lib/db';
import { contentLang } from '@/lib/locale';
import { siteCopy } from '@/lib/site-locale';

export default async function Page({params}:{params:Promise<{slug:string}>}) {
  const [{slug},t]=await Promise.all([params,siteCopy()]);
  const offers=process.env.DATABASE_URL?await withDb(db=>listContent(db)):[];
  const offer=offers.find(node=>node.slug===slug&&node.kind==='post'&&node.data.postKind==='offer');
  if(!offer)notFound();
  return <article>
    <Link className="btn btn-outline btn-small" href="/offers">← {t('Акции','Offers')}</Link>
    <PageHead title={offer.title} description={offer.description} kicker={t('Акции JUICY','JUICY offers')} lang={contentLang(offer.language)}/>
    {offer.cover?<div className="article-photo"><Photo name={offer.cover} alt={offer.title}/></div>:null}
    <div lang={contentLang(offer.language)}><RichText text={offer.data.body}/></div>
  </article>;
}
