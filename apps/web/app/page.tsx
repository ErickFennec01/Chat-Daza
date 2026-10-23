import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Dashboard } from './dashboard';

export default async function Home() {
  const session = (await cookies()).get('daza_session')?.value;
  if (!session) redirect('/login');
  return <Dashboard />;
}
