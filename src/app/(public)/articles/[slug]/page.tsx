import { notFound } from 'next/navigation';
import { ArticleFavorite,publicArticles } from '@/components/public-content';
import { publicFavorites } from '@/lib/pages';
import { PageHead,Photo,RichText } from '@/components/cards';
import { siteLocale } from '@/lib/site-locale';
import { copy } from '@/lib/locale';
export default async function Page({params}:{params:Promise<{slug:string}>}) {
  const [{slug},locale]=await Promise.all([params,siteLocale()]);
  const [articles,favorites]=await Promise.all([publicArticles(locale),publicFavorites()]);
  const article=articles.find(item=>item.slug===slug);
  if(!article)notFound();
  return <article lang={article.lang}><PageHead title={article.title} description={article.description} kicker={copy(locale)('Открытая статья','Public article')}/>
    {article.image?<div className="article-photo"><Photo name={article.image} alt={article.title} priority/></div>:null}
    <RichText text={article.body}/>
    <div className="detail-actions"><ArticleFavorite article={article} favorites={favorites}/></div>
  </article>;
}
