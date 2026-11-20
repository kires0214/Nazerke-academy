import Link from 'next/link';
import { Photo } from './cards';
import { withDb } from '@/lib/db';
import { listContent } from '@/lib/content';
import { contentLang,copy,type SiteLocale } from '@/lib/locale';
export const articles=[
  {slug:'kenwood',title:'Первое знакомство с Kenwood',image:'mixer.webp',description:'На что обратить внимание перед первым использованием.',body:'Перед первым использованием изучите инструкцию именно вашей модели. Проверьте комплектацию, установите машину на устойчивую поверхность и познакомьтесь с органами управления. Сборку насадок выполняйте при отключённом питании.'},
  {slug:'dough',title:'Пять привычек для идеального теста',image:'dough.webp',description:'Температура, влажность, точность и время замеса.',body:'Взвешивайте ингредиенты. Следите за температурой продуктов. Добавляйте жидкость постепенно. Учитывайте время замеса. Давайте тесту отдохнуть. Режим работы и допустимую загрузку сверяйте с инструкцией вашей машины.'},
  {slug:'care',title:'Уход за насадками: простые правила',image:'cleaning.webp',description:'Как сохранить насадки в хорошем состоянии.',body:'Отключайте машину от сети перед снятием насадок. Способ очистки зависит от конкретной модели: не все детали можно мыть водой или в посудомоечной машине. Следуйте инструкции производителя и полностью высушивайте разрешённые к мытью детали.'},
];
const english:Record<string,{title:string;description:string;body:string}>={
  kenwood:{title:'Getting started with Kenwood',description:'What to check before your first use.',
    body:'Read the manual for your specific model before using it. Check the included parts, set the machine on a stable surface, and familiarize yourself with the controls. Disconnect the power before assembling attachments.'},
  dough:{title:'Five habits for better dough',description:'Temperature, hydration, accuracy, and kneading time.',
    body:'Weigh your ingredients. Watch their temperature. Add liquid gradually. Keep track of kneading time. Let the dough rest. Check your machine manual for the recommended settings and maximum load.'},
  care:{title:'Simple rules for attachment care',description:'How to keep your attachments in good condition.',
    body:'Unplug the machine before removing attachments. Cleaning instructions vary by model. Some parts are unsuitable for washing in water or in a dishwasher. Follow the manufacturer’s directions and dry washable parts completely.'},
};
export async function publicArticles(locale:SiteLocale='ru') {
  const builtIn=articles.map(article=>({...article,...(locale==='en'?english[article.slug]:{}),lang:locale}));
  if(!process.env.DATABASE_URL)return builtIn;
  const posts=(await withDb(db=>listContent(db))).filter(n=>n.kind==='post'&&n.data.postKind==='article');
  return [...builtIn.filter(a=>!posts.some(p=>p.slug===a.slug)),...posts.map(n=>({slug:n.slug,title:n.title,image:n.cover??'',description:n.description,body:n.data.body,lang:contentLang(n.language)}))];
}
export async function PublicArticles({locale='ru'}:{locale?:SiteLocale}={}) {
  const items=await publicArticles(locale),t=copy(locale);
  return <div className="cards">{items.map(a=><Link href={'/articles/'+a.slug} className="card" key={a.slug}>
    {a.image?<div className="card-img"><Photo name={a.image} alt={a.title}/></div>:null}
    <div className="card-body"><span className="meta">{t('Открытая статья','Public article')}</span>
      <h3 lang={a.lang}>{a.title}</h3><p lang={a.lang}>{a.description}</p><span className="card-action">{t('Читать','Read')} →</span></div>
  </Link>)}</div>;
}
