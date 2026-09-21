'use client';

import dynamic from 'next/dynamic';

const LoginPage = dynamic(
  () => import('../../pages-components/auth/LoginPage').then((mod) => mod.LoginPage),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#0b3b60', fontWeight: 600 }}>
        Loading Authentication Portal...
      </div>
    ),
  },
);

export default function Page() {
  return <LoginPage />;
}
