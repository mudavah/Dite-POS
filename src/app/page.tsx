import { redirect } from 'next/navigation';
import { auth } from '@/app/api/auth/[...nextauth]/route';

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect('/pos');
  }

  redirect('/login');
}
