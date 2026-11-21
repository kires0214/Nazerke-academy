import Link from 'next/link';
import type { AuditFilter,auditPage } from '@/lib/activity';

const names:Record<string,string>={
  'page.view':'Открыл страницу','device.register':'Привязал браузер','device.reset':'Сбросил привязку браузера',
  'session.replace':'Вошёл через Telegram','session.logout':'Вышел из аккаунта',
  'system.bootstrap_techadmin':'Назначен первый Tech Admin','system.promote_techadmin':'Назначил Tech Admin','account.staff':'Изменил роль или права',
  'account.approve':'Подтвердил доступ','account.block':'Заблокировал аккаунт','account.unblock':'Снял блокировку',
  'account.learning':'Изменил учебный допуск','account.ambassador':'Изменил допуск амбассадора',
  'registration.invite':'Пригласил пользователя','registration.decline':'Отклонил заявку',
  'registration.link.create':'Создал ссылку-приглашение','registration.link.revoke':'Отозвал ссылку-приглашение',
  'registration.link.use':'Подал заявку по ссылке-приглашению',
  'content.draft':'Сохранил черновик','content.published':'Опубликовал материал','content.hidden':'Снял с публикации',
  'content.archived':'Архивировал материал','content.delete':'Удалил материал','media.upload':'Загрузил файл',
  'media.mux.create':'Начал загрузку видео','media.delete':'Удалил файл','lesson.complete':'Отметил урок завершённым',
  'favorite.add':'Добавил в избранное','favorite.remove':'Убрал из избранного',
  'event.registered':'Записался на встречу','event.waitlist':'Встал в лист ожидания',
  'event.cancelled':'Отменил запись','event.city_interest':'Оставил заявку на встречу',
  'support.message':'Обратился в поддержку','support.reply':'Ответил на обращение','notifications.retry':'Повторил отправку уведомлений',
};
const times=new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Qyzylorda',dateStyle:'short',timeStyle:'medium'});

export function AuditPanel({result,filter,full}:{result:Awaited<ReturnType<typeof auditPage>>;filter:AuditFilter;full:boolean}) {
  const href=(page:number)=>'/admin/audit?'+new URLSearchParams({days:String(filter.days),kind:filter.kind,q:filter.q,page:String(page)});
  return <>
    <h1>Журнал действий</h1>
    <p>{full?'Учебная активность и действия сотрудников.':'Ваши действия и активность учеников.'} Время по Кызылорде.</p>
    <form className="filters audit-filters" method="GET" action="/admin/audit">
      <label>Период<select name="days" defaultValue={filter.days}><option value="7">7 дней</option><option value="30">30 дней</option></select></label>
      <label>События<select name="kind" defaultValue={filter.kind}><option value="all">Все</option><option value="visits">Посещения</option><option value="actions">Действия</option></select></label>
      <label>Поиск<input name="q" defaultValue={filter.q} maxLength={120} placeholder="Имя, путь или действие"/></label>
      <button className="btn btn-dark" type="submit">Показать</button>
    </form>
    {result.rows.length?<div className="audit-table-wrap" role="region" tabIndex={0} aria-label="Таблица журнала">
      <table className="audit-table">
        <caption className="sr-only">Действия и посещения за выбранный период</caption>
        <thead><tr><th scope="col">Когда</th><th scope="col">Кто</th><th scope="col">Действие</th><th scope="col">Страница или объект</th><th scope="col">Посещений</th></tr></thead>
        <tbody>{result.rows.map(row=><tr key={row.id}>
          <td><time dateTime={new Date(row.created_at).toISOString()}>{times.format(new Date(row.created_at))}</time></td>
          <td>{row.actor_name??'Система'}{full&&row.actor_role?<small>{row.actor_role}</small>:null}</td>
          <td>{names[row.operation]??row.operation}</td><td>{row.entity_id}</td><td>{row.visit_count??'·'}</td>
        </tr>)}</tbody>
      </table>
    </div>:<p className="empty">За этот период подходящих записей нет.</p>}
    <div className="detail-actions">
      {filter.page>1?<Link className="btn btn-outline" href={href(filter.page-1)}>Назад</Link>:null}
      {result.hasMore?<Link className="btn btn-outline" href={href(filter.page+1)}>Далее</Link>:null}
    </div>
  </>;
}
