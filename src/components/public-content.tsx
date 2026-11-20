import Link from 'next/link';
import { Photo } from './cards';
import { withDb } from '@/lib/db';
import { listContent } from '@/lib/content';
import { contentLang,copy,type SiteLocale } from '@/lib/locale';
import type { BuiltinArticleKey } from '@/lib/catalog';
import { publicFavorites } from '@/lib/pages';
import { FavoriteButton } from './actions';
export const articles=[
  {slug:'kenwood',title:'Первое знакомство с Kenwood',image:'mixer.webp',description:'На что обратить внимание перед первым использованием.',body:'Перед первым использованием изучите инструкцию именно вашей модели. Проверьте комплектацию, установите машину на устойчивую поверхность и познакомьтесь с органами управления. Сборку насадок выполняйте при отключённом питании.'},
  {slug:'dough',title:'Пять привычек для идеального теста',image:'dough.webp',description:'Температура, влажность, точность и время замеса.',body:'Взвешивайте ингредиенты. Следите за температурой продуктов. Добавляйте жидкость постепенно. Учитывайте время замеса. Давайте тесту отдохнуть. Режим работы и допустимую загрузку сверяйте с инструкцией вашей машины.'},
  {slug:'care',title:'Уход за насадками: простые правила',image:'cleaning.webp',description:'Как сохранить насадки в хорошем состоянии.',body:'Отключайте машину от сети перед снятием насадок. Способ очистки зависит от конкретной модели: не все детали можно мыть водой или в посудомоечной машине. Следуйте инструкции производителя и полностью высушивайте разрешённые к мытью детали.'},
] satisfies {slug:BuiltinArticleKey;title:string;image:string;description:string;body:string}[];
const english:Record<string,{title:string;description:string;body:string}>={
  kenwood:{title:'Getting started with Kenwood',description:'What to check before your first use.',
    body:'Read the manual for your specific model before using it. Check the included parts, set the machine on a stable surface, and familiarize yourself with the controls. Disconnect the power before assembling attachments.'},
  dough:{title:'Five habits for better dough',description:'Temperature, hydration, accuracy, and kneading time.',
    body:'Weigh your ingredients. Watch their temperature. Add liquid gradually. Keep track of kneading time. Let the dough rest. Check your machine manual for the recommended settings and maximum load.'},
  care:{title:'Simple rules for attachment care',description:'How to keep your attachments in good condition.',
    body:'Unplug the machine before removing attachments. Cleaning instructions vary by model. Some parts are unsuitable for washing in water or in a dishwasher. Follow the manufacturer’s directions and dry washable parts completely.'},
};
export type PublicArticle={slug:string;title:string;image:string;description:string;body:string;lang:string;
  favorite:{builtin:BuiltinArticleKey}|{contentId:string}};
export function builtinArticles(locale:SiteLocale) {
  return articles.map(article=>({...article,...(locale==='en'?english[article.slug]:{}),lang:locale,favorite:{builtin:article.slug}}));
}
export async function publicArticles(locale:SiteLocale='ru'):Promise<PublicArticle[]> {
  const builtIn=builtinArticles(locale);
  if(!process.env.DATABASE_URL)return builtIn;
  const posts=(await withDb(db=>listContent(db))).filter(n=>n.kind==='post'&&n.data.postKind==='article');
  return [...builtIn.filter(a=>!posts.some(p=>p.slug===a.slug)),...posts.map(n=>({slug:n.slug,title:n.title,image:n.cover??'',description:n.description,body:n.data.body,lang:contentLang(n.language),favorite:{contentId:n.id}}))];
}
export function ArticleFavorite({article,favorites,named=false}:{article:PublicArticle;favorites:Awaited<ReturnType<typeof publicFavorites>>;named?:boolean}) {
  if(!favorites)return null;
  if('builtin' in article.favorite){
    return <FavoriteButton url="/api/favorites/article" target={{article:article.favorite.builtin}}
      saved={favorites.articles.includes(article.favorite.builtin)} title={named?article.title:undefined}/>;
  }
  return <FavoriteButton url="/api/favorites" target={{contentId:article.favorite.contentId}}
    saved={favorites.content.includes(article.favorite.contentId)} title={named?article.title:undefined}/>;
}
export function ArticleCards({items,locale,favorites}:{items:PublicArticle[];locale:SiteLocale;favorites:Awaited<ReturnType<typeof publicFavorites>>}) {
  const t=copy(locale);
  if(!items.length)return null;
  return <div className="cards">{items.map(a=><article className="card article-card" key={a.slug}>
    <Link href={'/articles/'+a.slug} className="article-card-link">
      {a.image?<div className="card-img"><Photo name={a.image} alt={a.title}/></div>:null}
      <div className="card-body"><span className="meta">{t('Открытая статья','Public article')}</span>
        <h3 lang={a.lang}>{a.title}</h3><p lang={a.lang}>{a.description}</p><span className="card-action">{t('Читать','Read')} →</span></div>
    </Link>
    <ArticleFavorite article={a} favorites={favorites} named/>
  </article>)}</div>;
}
export async function PublicArticles({locale='ru'}:{locale?:SiteLocale}={}) {
  const [items,favorites]=await Promise.all([publicArticles(locale),publicFavorites()]);
  return <ArticleCards items={items} locale={locale} favorites={favorites}/>;
}
