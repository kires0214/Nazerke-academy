export const kinds=['section','course','module','lesson','attachment','recipe','collection','post','material','event'] as const;
export const equipmentBrands=['Kenwood','Braun'] as const;
export type EquipmentBrand=typeof equipmentBrands[number];
export const equipmentBrand=(data:{equipmentBrand?:EquipmentBrand})=>data.equipmentBrand??'Kenwood';
export const learningTracks=['kenwood','braun','ambassador'] as const;
export type LearningTrack=typeof learningTracks[number];
export const trackLabels:Record<LearningTrack,string>={kenwood:'Kenwood',braun:'Braun',ambassador:'Школа Амбассадора'};
export const orderSourceLabels={kaspi:'Kaspi',kenwood:'Сайт Kenwood',braun:'Сайт Braun'} as const;
export function contentTracks(audience:string,data:{equipmentBrand?:EquipmentBrand;tracks?:LearningTrack[]}) {
  if(audience==='ambassador')return ['ambassador'] as const;
  return data.tracks??[equipmentBrand(data)==='Braun'?'braun':'kenwood'];
}
export const assetNames=['mixer','processor','dicer','roller','cutter','mincer','juicer','blender','whisk','hook','pasta','biscuit','bread','manti','smoothie','salad','soup','pizza','dough','cleaning','tiramisu'];
export const grants=['content.read','content.edit','content.publish','content.delete','sections.manage','courses.manage','recipes.manage','media.upload','media.delete','events.manage','support.read','support.respond','students.read','students.approve','students.block','students.tracks','devices.reset','ambassadors.assign','announcements.manage','analytics.read','audit.read'] as const;
export const academyDetailKinds: Record<string,string> = {
  lessons:'lesson',recipes:'recipe',attachments:'attachment',courses:'course',collections:'collection',
  news:'post',materials:'material',events:'event',sections:'section',modules:'module',
};
