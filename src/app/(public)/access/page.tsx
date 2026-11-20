import Link from 'next/link';
import { PageHead } from '@/components/cards';
import { LogoutButton } from '@/components/actions';
import { pageUser } from '@/lib/pages';
import { siteCopy } from '@/lib/site-locale';
export default async function Page() {
  const [user,t]=await Promise.all([pageUser(),siteCopy()]);
  const approved=user.status==='approved';
  return <><PageHead title={approved?t('Доступ подтверждён','Access approved'):t('Ожидаем подтверждение','Awaiting approval')}
    description={approved?t('Вы можете перейти к обучению.','You can go to the Academy.'):t('Команда JUICY проверит вашу заявку.','The JUICY team will review your application.')}/>
    <div className="detail-actions">{approved?<Link className="btn btn-dark" href="/academy">{t('Перейти в академию','Go to Academy')}</Link>:
      <Link className="btn btn-outline" href="/access">{t('Проверить статус','Check status')}</Link>}<LogoutButton/></div></>;
}
