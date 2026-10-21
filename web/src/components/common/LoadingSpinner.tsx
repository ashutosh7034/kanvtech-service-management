import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullHeight?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Loading data...',
  size = 'md',
  fullHeight = false,
}) => {
  const spinnerSizes = {
    sm: { width: 20, height: 20, borderWidth: 2 },
    md: { width: 36, height: 36, borderWidth: 3 },
    lg: { width: 52, height: 52, borderWidth: 4 },
  };

  const { width, height, borderWidth } = spinnerSizes[size] || spinnerSizes.md;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: size === 'sm' ? '16px' : '48px 24px',
        minHeight: fullHeight ? '360px' : 'auto',
        color: '#64748b',
        gap: '14px',
      }}
    >
      <div
        style={{
          width,
          height,
          border: `${borderWidth}px solid #e2e8f0`,
          borderTopColor: '#2563eb',
          borderRadius: '50%',
          animation: 'kanvtech-spin 0.75s linear infinite',
        }}
      />
      {message && (
        <span style={{ fontSize: size === 'sm' ? '12px' : '14px', fontWeight: 500, color: '#475569' }}>
          {message}
        </span>
      )}
      <style>{`
        @keyframes kanvtech-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
