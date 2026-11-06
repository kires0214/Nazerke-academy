import { AcademyShell } from '@/components/shells';
import { academyData } from '@/lib/pages';
export const dynamic='force-dynamic';
export default async function Layout({children}:{children:React.ReactNode}) {const {user}=await academyData();return <AcademyShell user={user}>{children}</AcademyShell>;}
