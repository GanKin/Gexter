'use client';

import { useRouter } from 'next/navigation';

import { AuthPanel } from '@/components/auth-panel';

export default function RegisterPage() {
  const router = useRouter();

  return <AuthPanel mode="register" onAuthenticated={() => router.replace('/')} />;
}
