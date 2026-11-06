import { StudioShell } from '@/components/shells';
import { studioData } from '@/lib/pages';
export const dynamic='force-dynamic';
export default async function Layout({children}:{children:React.ReactNode}) {const {user}=await studioData();return <StudioShell user={user}>{children}</StudioShell>;}
