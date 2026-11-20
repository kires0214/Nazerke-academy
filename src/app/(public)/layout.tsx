import { PublicShell } from '@/components/shells';
import { publicPageUser } from '@/lib/pages';
export const dynamic='force-dynamic';
export default async function Layout({children}:{children:React.ReactNode}) {
  return <PublicShell user={await publicPageUser()}>{children}</PublicShell>;
}
