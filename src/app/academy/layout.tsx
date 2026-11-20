import { AcademyShell } from '@/components/shells';
import { academyData } from '@/lib/pages';
import { ActivityTracker } from '@/components/activity-tracker';
import { siteLocale } from '@/lib/site-locale';
export const dynamic='force-dynamic';
export default async function Layout({children}:{children:React.ReactNode}) {
  const [{user},locale]=await Promise.all([academyData(),siteLocale()]);
  return <AcademyShell user={user} locale={locale}><ActivityTracker/>{children}</AcademyShell>;
}
