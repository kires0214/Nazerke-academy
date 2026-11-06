import Link from 'next/link';
import type { Content } from '@/lib/content';

export function Photo({name,alt,priority=false}:{name:string;alt:string;priority?:boolean}) {
  return <img src={'/assets/'+name} alt={alt} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} decoding="async"/>;
}
export function PageHead({title,description,kicker='JUICY Academy'}:{title:string;description?:string;kicker?:string}) {
  return <div className="page-head"><span className="eyebrow">{kicker}</span><h1>{title}</h1>{description?<p>{description}</p>:null}</div>;
}
export function contentHref(node:Pick<Content,'kind'|'slug'>) {
  const route:Record<string,string>={lesson:'lessons',attachment:'attachments',recipe:'recipes',collection:'collections',course:'courses',post:'news',material:'materials',event:'events',section:'sections',module:'modules'};
  return '/academy/'+(route[node.kind]??'content')+'/'+node.slug;
}
export function ContentCards({nodes}:{nodes:Content[]}) {
  if(!nodes.length) return <p className="empty">Материалы появятся после публикации.</p>;
  return <div className="cards">{nodes.map(node=><Link className="card" key={node.id} href={contentHref(node)}>
    {node.cover?<div className={'card-img'+(node.kind==='attachment'?' product':'')}><Photo name={node.cover} alt={node.title}/></div>:null}
    <div className="card-body"><span className="meta">{node.language}{node.data.duration?` · ${node.data.duration} мин`:''}</span><h3>{node.title}</h3><p>{node.description}</p><span className="card-action">Открыть →</span></div>
  </Link>)}</div>;
}
export function RichText({text}:{text:string}) {
  // Markdown subset rendered as React text. Raw HTML and external embeds never execute.
  return <div className="rich-text">{text.split(/\n\s*\n/).filter(Boolean).map((block,i)=>block.startsWith('## ')?<h2 key={i}>{block.slice(3)}</h2>:<p key={i}>{block}</p>)}</div>;
}
