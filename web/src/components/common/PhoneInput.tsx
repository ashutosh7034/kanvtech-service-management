import React, { useState, useEffect } from 'react';

export interface CountryCodeConfig {
  code: string;
  country: string;
  flag: string;
  digits: number;
  maxDigits?: number;
  placeholder: string;
}

export const COUNTRY_CODES: CountryCodeConfig[] = [
  { code: '+91', country: 'India', flag: '🇮🇳', digits: 10, placeholder: '98765 43210' },
  { code: '+1', country: 'United States / Canada', flag: '🇺🇸', digits: 10, placeholder: '555 123 4567' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧', digits: 10, placeholder: '7911 123456' },
  { code: '+971', country: 'United Arab Emirates', flag: '🇦🇪', digits: 9, placeholder: '50 123 4567' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦', digits: 9, placeholder: '50 123 4567' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬', digits: 8, placeholder: '8123 4567' },
  { code: '+61', country: 'Australia', flag: '🇦🇺', digits: 9, placeholder: '412 345 678' },
  { code: '+49', country: 'Germany', flag: '🇩🇪', digits: 10, maxDigits: 11, placeholder: '151 12345678' },
  { code: '+33', country: 'France', flag: '🇫🇷', digits: 9, placeholder: '6 12 34 56 78' },
  { code: '+81', country: 'Japan', flag: '🇯🇵', digits: 10, placeholder: '90 1234 5678' },
  { code: '+86', country: 'China', flag: '🇨🇳', digits: 11, placeholder: '138 0013 8000' },
  { code: '+55', country: 'Brazil', flag: '🇧🇷', digits: 10, maxDigits: 11, placeholder: '11 98765 4321' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦', digits: 9, placeholder: '82 123 4567' },
  { code: '+64', country: 'New Zealand', flag: '🇳🇿', digits: 8, maxDigits: 10, placeholder: '21 123 4567' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾', digits: 9, maxDigits: 10, placeholder: '12 345 6789' },
  { code: '+63', country: 'Philippines', flag: '🇵🇭', digits: 10, placeholder: '917 123 4567' },
  { code: '+880', country: 'Bangladesh', flag: '🇧🇩', digits: 10, placeholder: '1712 345678' },
  { code: '+94', country: 'Sri Lanka', flag: '🇱🇰', digits: 9, placeholder: '77 123 4567' },
  { code: '+977', country: 'Nepal', flag: '🇳🇵', digits: 10, placeholder: '984 1234567' },
  { code: '+', country: 'Other / International', flag: '🌍', digits: 7, maxDigits: 15, placeholder: '1234567890' },
];

export function parsePhoneAndCountry(rawPhone?: string | null): { countryCode: string; nationalNumber: string } {
  if (!rawPhone || !rawPhone.trim()) {
    return { countryCode: '+91', nationalNumber: '' };
  }

  const trimmed = rawPhone.trim();

  // Sort country codes by length descending so +880 matches before +8
  const sorted = [...COUNTRY_CODES].filter(c => c.code !== '+').sort((a, b) => b.code.length - a.code.length);
  for (const c of sorted) {
    if (trimmed.startsWith(c.code)) {
      const rest = trimmed.slice(c.code.length).replace(/\D/g, '');
      return { countryCode: c.code, nationalNumber: rest };
    }
  }

  // If no recognized prefix, remove non-digits
  const digits = trimmed.replace(/\D/g, '');
  return { countryCode: '+91', nationalNumber: digits };
}

interface PhoneInputProps {
  value?: string;
  onChange: (fullFormattedPhone: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  error?: string | null;
  placeholder?: string;
  showHelper?: boolean;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value = '',
  onChange,
  required = false,
  disabled = false,
  className = '',
  id,
  name,
  error,
  placeholder,
  showHelper = true,
}) => {
  const parsed = parsePhoneAndCountry(value);
  const [selectedCode, setSelectedCode] = useState<string>(parsed.countryCode);
  const [localNumber, setLocalNumber] = useState<string>(parsed.nationalNumber);

  // Sync internal state if external value changes significantly
  useEffect(() => {
    const ext = parsePhoneAndCountry(value);
    if (ext.countryCode !== selectedCode || ext.nationalNumber !== localNumber) {
      setSelectedCode(ext.countryCode);
      setLocalNumber(ext.nationalNumber);
    }
  }, [value]);

  const currentCountry = COUNTRY_CODES.find((c) => c.code === selectedCode) || COUNTRY_CODES[0];
  const maxDigits = currentCountry.maxDigits || currentCountry.digits;
  const minDigits = currentCountry.digits;

  const handleCountryChange = (newCode: string) => {
    setSelectedCode(newCode);
    const country = COUNTRY_CODES.find((c) => c.code === newCode) || COUNTRY_CODES[0];
    const max = country.maxDigits || country.digits;
    const truncated = localNumber.slice(0, max);
    setLocalNumber(truncated);
    if (truncated) {
      onChange(`${newCode} ${truncated}`);
    } else {
      onChange('');
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, ''); // only digits
    const limited = raw.slice(0, maxDigits);
    setLocalNumber(limited);
    if (limited) {
      onChange(`${selectedCode} ${limited}`);
    } else {
      onChange('');
    }
  };

  const isLengthValid = localNumber.length >= minDigits && localNumber.length <= maxDigits;
  const isTooShort = localNumber.length > 0 && localNumber.length < minDigits;

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          border: error ? '1px solid #ef4444' : isTooShort ? '1px solid #f59e0b' : '1px solid #cbd5e1',
          borderRadius: 6,
          background: '#ffffff',
          overflow: 'hidden',
          transition: 'all 0.15s ease',
          boxShadow: error ? '0 0 0 1px #ef4444' : 'none',
        }}
      >
        {/* Country Selector Dropdown */}
        <div
          style={{
            position: 'relative',
            background: '#f8fafc',
            borderRight: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            minWidth: 120,
          }}
        >
          <select
            value={selectedCode}
            onChange={(e) => handleCountryChange(e.target.value)}
            disabled={disabled}
            aria-label="Country Code"
            style={{
              width: '100%',
              padding: '8px 10px',
              fontSize: 13,
              fontWeight: 600,
              color: '#1e293b',
              background: 'transparent',
              border: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              outline: 'none',
              appearance: 'none',
              WebkitAppearance: 'none',
              paddingRight: 24,
            }}
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c.code + c.country} value={c.code}>
                {c.flag} {c.code} ({c.country})
              </option>
            ))}
          </select>
          <div
            style={{
              position: 'absolute',
              right: 8,
              pointerEvents: 'none',
              fontSize: 10,
              color: '#64748b',
            }}
          >
            ▼
          </div>
        </div>

        {/* National Number Digits Input */}
        <input
          id={id}
          name={name}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={maxDigits}
          required={required}
          disabled={disabled}
          placeholder={placeholder || `${currentCountry.placeholder} (${minDigits === maxDigits ? minDigits : `${minDigits}-${maxDigits}`} digits)`}
          value={localNumber}
          onChange={handleNumberChange}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: 14,
            color: '#0f172a',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            letterSpacing: '0.02em',
          }}
        />

        {/* Live Digits Counter Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            fontSize: 11,
            fontWeight: 600,
            color: localNumber.length === 0 ? '#94a3b8' : isLengthValid ? '#16a34a' : '#f59e0b',
            background: '#f8fafc',
            borderLeft: '1px solid #f1f5f9',
            whiteSpace: 'nowrap',
          }}
          title={`Requires ${minDigits === maxDigits ? minDigits : `${minDigits} to ${maxDigits}`} digits for ${currentCountry.country}`}
        >
          {localNumber.length}/{minDigits === maxDigits ? minDigits : `${minDigits}-${maxDigits}`}
        </div>
      </div>

      {/* Helper text / error */}
      {showHelper && (
        <div style={{ marginTop: 4, fontSize: 11, display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
          <span>
            {currentCountry.flag} {currentCountry.country} requires <strong>{minDigits === maxDigits ? `${minDigits} digits` : `${minDigits} to ${maxDigits} digits`}</strong>
          </span>
          {isTooShort && (
            <span style={{ color: '#d97706', fontWeight: 500 }}>
              Need {minDigits - localNumber.length} more digit{minDigits - localNumber.length > 1 ? 's' : ''}
            </span>
          )}
          {isLengthValid && (
            <span style={{ color: '#16a34a', fontWeight: 500 }}>
              ✓ Valid length
            </span>
          )}
        </div>
      )}
    </div>
  );
};
