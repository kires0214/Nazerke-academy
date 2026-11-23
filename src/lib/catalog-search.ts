import { groupFor, kinds, learningTracks, sectionFor, type CatalogGroup, type LearningTrack } from './catalog';
import type { CatalogNode } from './content';
import { contentLanguages } from './locale';

export type CatalogSearch = ReturnType<typeof readCatalogSearch>;
export type CatalogGroupFilter = CatalogGroup | 'all';
export type SectionQuery = Record<string, string | string[] | undefined>;

export function readCatalogSearch(query: SectionQuery, options: {kinds?:boolean;tracks?:boolean} = {}) {
  return {
    q:typeof query.q==='string'?query.q.trim().slice(0,120):'',
    language:contentLanguages.find(language=>language===query.language),
    kind:options.kinds?kinds.find(kind=>kind===query.kind&&kind!=='event'):undefined,
    track:options.tracks?learningTracks.find(track=>track===query.track):undefined,
  };
}

const normalize = (value:string) => value.normalize('NFKC').toLocaleLowerCase('ru').replaceAll('ё','е');

export function searchCatalog(nodes:CatalogNode[],search:CatalogSearch) {
  const terms=normalize(search.q).split(/\s+/).filter(Boolean);
  return nodes.filter(node=>{
    if(search.language&&node.language!==search.language)return false;
    if(search.kind&&node.kind!==search.kind)return false;
    if(search.track&&sectionFor(node.audience,node.data)!==search.track)return false;
    // The Academy catalog has already stripped restricted detail from locked cards.
    const text=normalize([node.title,node.slug,node.data.model,node.data.category,node.data.city].join(' '));
    return terms.every(term=>text.includes(term));
  });
}

export function trackCatalog(nodes:CatalogNode[],track:LearningTrack,group:CatalogGroupFilter,includeLessons:boolean) {
  const byId=new Map(nodes.map(node=>[node.id,node]));
  return nodes.filter(node=>{
    if(!includeLessons&&node.parent_id)return false;
    const parent=node.parent_id?byId.get(node.parent_id):undefined;
    const root=(parent?.parent_id?byId.get(parent.parent_id):undefined)??parent??node;
    return root.kind!=='event'&&root.data.postKind!=='offer'&&root.data.postKind!=='coming-soon'&&
      sectionFor(root.audience,root.data)===track&&(group==='all'||groupFor(root.kind,root.data)===group);
  });
}

export function catalogUrl(path:string,params:Record<string,string|undefined>) {
  const query=new URLSearchParams();
  for(const [key,value] of Object.entries(params))if(value)query.set(key,value);
  return query.size?path+'?'+query:path;
}
