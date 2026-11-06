import Link from 'next/link';
import { PageHead } from '@/components/cards';
import { ActionButton } from '@/components/actions';
import { pageUser } from '@/lib/pages';
export default async function Page() {
  const user=await pageUser();return <><PageHead title={user.status==='approved'?'Доступ подтверждён':'Ожидаем подтверждение'} description={user.status==='approved'?'Вы можете перейти к обучению.':'Команда JUICY проверит вашу заявку. Новая регистрация не требуется.'}/>
    {user.status==='approved'?<Link className="btn btn-dark" href="/academy">Перейти в академию</Link>:<Link className="btn btn-outline" href="/access">Проверить статус</Link>}<ActionButton url="/api/auth/logout" label="Выйти" goTo="/"/></>;
}
