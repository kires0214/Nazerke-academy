export const kinds=['section','course','module','lesson','attachment','recipe','collection','post','material','event'] as const;
export const assetNames=['mixer','processor','dicer','roller','cutter','mincer','juicer','blender','whisk','hook','pasta','biscuit','bread','manti','smoothie','salad','soup','pizza','dough','cleaning','tiramisu'];
export const grants=['content.read','content.edit','content.publish','content.delete','sections.manage','courses.manage','recipes.manage','media.upload','media.delete','events.manage','support.read','support.respond','students.read','students.approve','students.block','devices.reset','ambassadors.assign','announcements.manage','analytics.read','audit.read'] as const;
export const academyDetailKinds: Record<string,string> = {
  lessons:'lesson',recipes:'recipe',attachments:'attachment',courses:'course',collections:'collection',
  news:'post',materials:'material',events:'event',sections:'section',modules:'module',
};
