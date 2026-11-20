import { copy,type SiteLocale } from './locale';

export function academyNavigation(locale:SiteLocale) {
  const t=copy(locale);
  return [
    {href:'/academy',label:t('Главная','Home')},
    {href:'/academy/offers',label:t('Акции','Offers'),summary:t('Актуальные предложения JUICY','Current offers from JUICY')},
    {href:'/academy/kenwood',label:'Kenwood',summary:t('Обучение, рецепты и насадки','Lessons, recipes and attachments')},
    {href:'/academy/braun',label:'Braun',summary:t('Обучение, рецепты и насадки','Lessons, recipes and attachments')},
    {href:'/academy/ambassadors',label:t('Школа Амбассадора','Ambassador School'),summary:t('Программа для амбассадоров','The ambassador program')},
    {href:'/academy/events',label:t('Мастер-классы','Masterclasses'),summary:t('Календарь встреч и запись','Event calendar and booking')},
    {href:'/academy/contacts',label:t('Контакты','Contact'),summary:t('Поддержка и вопросы о доступе','Support and access questions')},
  ];
}

export function publicNavigation(locale:SiteLocale) {
  const t=copy(locale);
  return [
    {href:'/',label:t('Главная','Home')},
    {href:'/offers',label:t('Акции','Offers'),summary:t('Актуальные предложения JUICY','Current offers from JUICY')},
    {href:'/about',label:t('Об академии','About'),summary:t('Познакомьтесь с JUICY и Назерке','Meet Nazerke and JUICY')},
    {href:'/articles',label:t('Статьи','Articles'),summary:t('Техника и кулинарные привычки','Equipment and kitchen habits')},
    {href:'/events',label:t('Мастер-классы','Masterclasses'),summary:t('Календарь открытых встреч','Public event calendar')},
    {href:'/contacts',label:t('Контакты','Contact'),summary:t('Свяжитесь с командой JUICY','Get in touch with JUICY')},
  ];
}
