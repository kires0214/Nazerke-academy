import Link from 'next/link';
import type { CatalogNode,Content } from '@/lib/content';
import { contentLang,copy,type SiteLocale } from '@/lib/locale';

export function Photo({name,alt,priority=false}:{name:string;alt:string;priority?:boolean}) {
  return <img src={'/assets/'+name} alt={alt} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} decoding="async"/>;
}
export function PageHead({title,description,kicker='JUICY Academy',lang}:{title:string;description?:string;kicker?:string;lang?:string}) {
  return <div className="page-head"><span className="eyebrow">{kicker}</span><h1 lang={lang}>{title}</h1>{description?<p lang={lang}>{description}</p>:null}</div>;
}
export function contentHref(node:Pick<Content,'kind'|'slug'>) {
  const route:Record<string,string>={lesson:'lessons',attachment:'attachments',recipe:'recipes',collection:'collections',course:'courses',post:'news',material:'materials',event:'events',section:'sections',module:'modules'};
  return '/academy/'+(route[node.kind]??'content')+'/'+node.slug;
}
export function ContentCards({nodes,linkFor=contentHref,locale='ru'}:{nodes:CatalogNode[];linkFor?:(node:Content)=>string;locale?:SiteLocale}) {
  const t=copy(locale);
  if(!nodes.length) return <p className="empty">{t('Материалы появятся после публикации.','Materials will appear here once published.')}</p>;
  return <div className="cards">{nodes.map(node=><Link className="card" key={node.id} href={linkFor(node)}>
    {node.cover?<div className={'card-img'+(node.kind==='attachment'?' product':'')}><Photo name={node.cover} alt={node.title}/></div>:null}
    <div className="card-body"><span className="meta">{node.language==='KZ'?t('Архивный язык','Archived language'):node.language}{node.data.duration?` · ${node.data.duration} ${t('мин','min')}`:''}</span>
      <h3 lang={contentLang(node.language)}>{node.title}</h3>{node.description?<p lang={contentLang(node.language)}>{node.description}</p>:null}
      <span className="card-action">{node.locked?t('Требуется допуск','Access required'):t('Открыть','Open')}{node.locked?'':' →'}</span>
    </div>
  </Link>)}</div>;
}
export function RichText({text}:{text:string}) {
  // Markdown subset rendered as React text. Raw HTML and external embeds never execute.
  return <div className="rich-text">{text.split(/\n\s*\n/).filter(Boolean).map((block,i)=>block.startsWith('## ')?<h2 key={i}>{block.slice(3)}</h2>:<p key={i}>{block}</p>)}</div>;
}
