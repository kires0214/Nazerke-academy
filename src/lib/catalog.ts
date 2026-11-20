export const kinds=['section','course','module','lesson','attachment','recipe','collection','post','material','event'] as const;
export const equipmentBrands=['Kenwood','Braun'] as const;
export type EquipmentBrand=typeof equipmentBrands[number];
export const equipmentBrand=(data:{equipmentBrand?:EquipmentBrand})=>data.equipmentBrand??'Kenwood';
export const learningTracks=['kenwood','braun','ambassador'] as const;
export type LearningTrack=typeof learningTracks[number];
export const trackLabels:Record<LearningTrack,string>={kenwood:'Kenwood',braun:'Braun',ambassador:'Школа Амбассадора'};
export const catalogGroups=['training','recipes','attachments'] as const;
export const builtinArticleKeys=['kenwood','dough','care'] as const;
export type BuiltinArticleKey=typeof builtinArticleKeys[number];
export type CatalogGroup=typeof catalogGroups[number];
export type CatalogPlacement={catalogSection?:LearningTrack;catalogGroup?:CatalogGroup;equipmentBrand?:EquipmentBrand};
export function sectionFor(audience:string,data:CatalogPlacement):LearningTrack {
  return data.catalogSection??(audience==='ambassador'?'ambassador':equipmentBrand(data)==='Braun'?'braun':'kenwood');
}
export function groupFor(kind:string,data:CatalogPlacement):CatalogGroup {
  return data.catalogGroup??(kind==='recipe'||kind==='collection'?'recipes':kind==='attachment'?'attachments':'training');
}
export const sectionHref=(track:LearningTrack)=>'/academy/'+(track==='ambassador'?'ambassadors':track);
export const orderSourceLabels={kaspi:'Kaspi',kenwood:'Сайт Kenwood',braun:'Сайт Braun'} as const;
export function contentTracks(audience:string,data:CatalogPlacement&{tracks?:LearningTrack[]}) {
  return data.tracks??[sectionFor(audience,data)];
}
export const assetNames=['mixer','processor','dicer','roller','cutter','mincer','juicer','blender','whisk','hook','pasta','biscuit','bread','manti','smoothie','salad','soup','pizza','dough','cleaning','tiramisu'];
export const grants=['content.read','content.edit','content.publish','content.delete','sections.manage','courses.manage','recipes.manage','media.upload','media.delete','events.manage','support.read','support.respond','students.read','students.approve','students.block','students.tracks','devices.reset','ambassadors.assign','announcements.manage','analytics.read','audit.read'] as const;
export const academyDetailKinds: Record<string,string> = {
  lessons:'lesson',recipes:'recipe',attachments:'attachment',courses:'course',collections:'collection',
  news:'post',offers:'post',materials:'material',events:'event',sections:'section',modules:'module',
};
