import React from 'react';
import { TicketStatus } from '../../types';

export const StatusBadge: React.FC<{ status: TicketStatus | string }> = ({ status }) => {
  const normalized = status?.toLowerCase();
  let label = status;

  switch (status) {
    case 'OPEN':
      label = 'Open';
      break;
    case 'IN_PROGRESS':
      label = 'In Progress';
      break;
    case 'RESOLVED':
      label = 'Resolved';
      break;
    case 'MANAGER_REVIEW':
      label = 'Manager Review';
      break;
    case 'CUSTOMER_FEEDBACK':
      label = 'Feedback Required';
      break;
    case 'CLOSED':
      label = 'Closed';
      break;
  }

  return (
    <span className={`badge badge-${normalized}`}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
      {label}
    </span>
  );
};
