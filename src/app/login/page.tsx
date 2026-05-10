'use client';

import { useRouter } from 'next/navigation';

import { AuthPanel } from '@/components/auth-panel';

export default function LoginPage() {
  const router = useRouter();

  return <AuthPanel mode="login" onAuthenticated={() => router.replace('/')} />;
}
