import React from 'react';
import { SLAStatus } from '../../types';
import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';

export const SLABadge: React.FC<{
  status?: SLAStatus;
  remainingSeconds?: number;
  showCountdown?: boolean;
}> = ({ status = 'ON_TRACK', remainingSeconds, showCountdown = true }) => {
  const normalized = status.toLowerCase();

  const formatRemaining = (sec?: number) => {
    if (sec === undefined) return '';
    if (sec <= 0) return 'Overdue';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m remaining`;
  };

  const getIcon = () => {
    switch (status) {
      case 'BREACHED':
        return <XCircle size={13} />;
      case 'WARNING':
        return <AlertTriangle size={13} />;
      case 'MET':
        return <CheckCircle2 size={13} />;
      default:
        return <Clock size={13} />;
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'BREACHED':
        return 'SLA Breached';
      case 'WARNING':
        return 'SLA Risk (75%)';
      case 'MET':
        return 'SLA Met';
      default:
        return 'SLA On Track';
    }
  };

  return (
    <span className={`badge sla-${normalized}`} title={status}>
      {getIcon()}
      <span>{getLabel()}</span>
      {showCountdown && remainingSeconds !== undefined && status !== 'MET' && (
        <span style={{ opacity: 0.85, marginLeft: 2, fontWeight: 500 }}>
          • {formatRemaining(remainingSeconds)}
        </span>
      )}
    </span>
  );
};
