import type { Metadata } from 'next';
import '../styles/design-tokens.css';
import '../styles/app.css';
import { AuthProvider } from '../context/AuthContext';

export const metadata: Metadata = {
  title: 'Kanvtech Service Management Platform',
  description: 'Enterprise Service Delivery & Incident Resolution Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
