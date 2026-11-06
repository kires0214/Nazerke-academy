import Link from 'next/link';
import { Photo,ContentCards,contentHref } from '@/components/cards';
import { academyData } from '@/lib/pages';
export default async function Page() {
  const {user,nodes,progress}=await academyData();const resume=nodes.find(n=>n.id===progress[0]?.lesson_id),first=nodes.find(n=>n.kind==='lesson');
  return <><section className="academy-hero"><div className="copy"><span className="eyebrow">Ваше пространство JUICY</span><h1>Рады видеть вас,<br/><em>{user.display_name}</em></h1><p>Маленькие шаги, любимые рецепты и уверенность на кухне.</p>{resume||first?<Link className="btn btn-dark" href={contentHref((resume??first)!)}>{resume?'Продолжить обучение':'Начните здесь'} →</Link>:null}</div><div className="welcome-photo"><Photo name="nazerke-welcome.avif" alt="Приветствие Назерке" priority/></div></section>
  <section className="section"><div className="section-heading"><h2>Ваше <em>обучение</em></h2><Link className="small-link" href="/academy/learn">Все направления →</Link></div><ContentCards nodes={nodes.filter(n=>n.kind==='course')}/></section>
  <section className="section"><div className="section-heading"><h2>Новые рецепты</h2><Link className="small-link" href="/academy/recipes">Все рецепты →</Link></div><ContentCards nodes={nodes.filter(n=>n.kind==='recipe').slice(0,3)}/></section>
  {nodes.some(n=>n.kind==='post'&&n.data.postKind==='news')?<section className="section"><h2>Новости JUICY</h2><ContentCards nodes={nodes.filter(n=>n.kind==='post'&&n.data.postKind==='news')}/></section>:null}
  {nodes.some(n=>n.kind==='event'&&n.data.startsAt&&new Date(n.data.startsAt)>new Date())?<section className="section"><h2>Ближайшие встречи</h2><ContentCards nodes={nodes.filter(n=>n.kind==='event'&&n.data.startsAt&&new Date(n.data.startsAt)>new Date())}/></section>:null}</>;
}
