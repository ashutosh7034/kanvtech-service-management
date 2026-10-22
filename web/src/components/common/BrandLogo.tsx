import React from 'react';

interface BrandLogoProps {
  variant?: 'horizontal' | 'icon';
  height?: number | string;
  width?: number | string;
  className?: string;
  style?: React.CSSProperties;
  showSubtitle?: boolean;
  onClick?: () => void;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'horizontal',
  height,
  width,
  className = '',
  style = {},
  showSubtitle = false,
  onClick,
}) => {
  const isHorizontal = variant === 'horizontal';
  const src = isHorizontal
    ? '/assets/kanvtech-logo.jpeg'
    : '/assets/kanvtech-app-icon.png';

  const defaultHeight = isHorizontal ? 38 : 34;
  const defaultWidth = isHorizontal ? 104 : 34;

  const appliedHeight = height ?? defaultHeight;
  const appliedWidth = width ?? (isHorizontal ? 'auto' : defaultWidth);

  return (
    <div
      className={`brand-logo-container ${className}`}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        ...style,
      }}
    >
      <img
        src={src}
        alt="KANVTECH official logo"
        style={{
          height: appliedHeight,
          width: appliedWidth,
          objectFit: 'contain',
          display: 'block',
          borderRadius: isHorizontal ? 4 : 6,
        }}
        loading="eager"
      />
      {showSubtitle && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', color: '#ffffff' }}>
            KANVTECH
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em' }}>
            SERVICE PLATFORM
          </span>
        </div>
      )}
    </div>
  );
};

export default BrandLogo;
