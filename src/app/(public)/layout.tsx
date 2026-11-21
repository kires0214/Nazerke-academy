import { PublicShell } from '@/components/shells';
import { publicPageUser } from '@/lib/pages';
import { siteLocale } from '@/lib/site-locale';
export const dynamic='force-dynamic';
export default async function Layout({children}:{children:React.ReactNode}) {
  const [user,locale]=await Promise.all([publicPageUser(),siteLocale()]);
  return <PublicShell user={user} locale={locale}>{children}</PublicShell>;
}
