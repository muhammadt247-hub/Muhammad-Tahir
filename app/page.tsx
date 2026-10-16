import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/supabase/server';

export default async function HomePage() {
  const user = await requireUser();
  if (user) {
    redirect('/generator');
  } else {
    redirect('/login');
  }
}
