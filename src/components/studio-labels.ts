import type { ContentInput } from '@/lib/content';

export type StudioKind = ContentInput['kind'];
export type StudioAudience = ContentInput['audience'];

export const kindLabels: Record<StudioKind,string> = {
  section:'Раздел', course:'Курс', module:'Модуль', lesson:'Урок', attachment:'Насадка',
  recipe:'Рецепт', collection:'Подборка', post:'Статья, новость или FAQ', material:'Памятка или файл', event:'Мастер-класс',
};
export const studioKindGroups = [
  {label:'Обучение', kinds:['course','module','lesson']},
  {label:'Кулинария', kinds:['recipe','attachment','collection']},
  {label:'Публикации', kinds:['post','event','section','material']},
] satisfies {label:string;kinds:StudioKind[]}[];
export const statusLabels: Record<ContentInput['status'],string> = {
  draft:'Черновик', published:'Опубликовано', hidden:'Снято с публикации', archived:'В архиве',
};
export const audienceLabels: Record<StudioAudience,string> = {
  academy:'Ученики Академии', ambassador:'Амбассадоры', public:'Все посетители',
};
export const mediaKindLabels: Record<string,string> = {video:'Видео',image:'Изображение',document:'PDF'};
export const mediaStatusLabels: Record<string,string> = {
  uploading:'Ожидает загрузки',processing:'В обработке',ready:'Готово',failed:'Ошибка',
};

const time = new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Qyzylorda',dateStyle:'medium',timeStyle:'short'});
export type StudioMedia = {id:string;kind:string;state:string;created_at:string;name?:string};
export function mediaDetail(media:StudioMedia) {
  return [mediaStatusLabels[media.state], time.format(new Date(media.created_at)), media.id.slice(0,8)].join(' · ');
}
