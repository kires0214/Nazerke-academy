import Link from 'next/link';
import { Photo } from './cards';
import { withDb } from '@/lib/db';
import { listContent } from '@/lib/content';
export const articles=[
  {slug:'kenwood',title:'Первое знакомство с Kenwood',image:'mixer.webp',description:'На что обратить внимание перед первым использованием.',body:'Перед первым использованием изучите инструкцию именно вашей модели. Проверьте комплектацию, установите машину на устойчивую поверхность и познакомьтесь с органами управления. Сборку насадок выполняйте при отключённом питании.'},
  {slug:'dough',title:'Пять привычек для идеального теста',image:'dough.webp',description:'Температура, влажность, точность и время замеса.',body:'Взвешивайте ингредиенты. Следите за температурой продуктов. Добавляйте жидкость постепенно. Учитывайте время замеса. Давайте тесту отдохнуть. Режим работы и допустимую загрузку сверяйте с инструкцией вашей машины.'},
  {slug:'care',title:'Уход за насадками: простые правила',image:'cleaning.webp',description:'Как сохранить насадки в хорошем состоянии.',body:'Отключайте машину от сети перед снятием насадок. Способ очистки зависит от конкретной модели: не все детали можно мыть водой или в посудомоечной машине. Следуйте инструкции производителя и полностью высушивайте разрешённые к мытью детали.'},
];
export async function publicArticles() {
  if(!process.env.DATABASE_URL)return articles;
  const posts=(await withDb(db=>listContent(db))).filter(n=>n.kind==='post'&&n.data.postKind==='article');
  return [...articles.filter(a=>!posts.some(p=>p.slug===a.slug)),...posts.map(n=>({slug:n.slug,title:n.title,image:n.cover??'',description:n.description,body:n.data.body}))];
}
export async function PublicArticles() {const items=await publicArticles();return <div className="cards">{items.map(a=><Link href={'/articles/'+a.slug} className="card" key={a.slug}>{a.image?<div className="card-img"><Photo name={a.image} alt={a.title}/></div>:null}<div className="card-body"><span className="meta">Открытая статья</span><h3>{a.title}</h3><p>{a.description}</p><span className="card-action">Читать →</span></div></Link>)}</div>;}
