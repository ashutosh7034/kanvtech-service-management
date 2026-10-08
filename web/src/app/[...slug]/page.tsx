'use client';

import React, { useEffect, useState } from 'react';
import App from '../../App';

export default function CatchAllPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#0b3b60', fontWeight: 600 }}>
        Initializing Kanvtech Enterprise Session...
      </div>
    );
  }

  return <App />;
}
