import React from 'react';
import {
  PlusCircle,
  UserCheck,
  Play,
  ArrowUpRight,
  CheckCircle,
  CheckSquare,
  Star,
  Lock,
  FileText,
  Paperclip,
} from 'lucide-react';

interface TimelineEntry {
  id: number;
  action_type: string;
  title: string;
  description?: string;
  metadata_json?: string;
  created_at: string;
  actor_email?: string;
  actor_role?: string;
}

export const TicketTimeline: React.FC<{ items: TimelineEntry[] }> = ({ items }) => {
  const getActionConfig = (actionType: string) => {
    switch (actionType) {
      case 'CREATED':
        return { icon: <PlusCircle size={12} />, className: 'created', label: 'Created' };
      case 'ASSIGNED':
        return { icon: <UserCheck size={12} />, className: 'assigned', label: 'Assigned' };
      case 'STARTED':
        return { icon: <Play size={12} />, className: 'started', label: 'Work Started' };
      case 'ESCALATED':
        return { icon: <ArrowUpRight size={12} />, className: 'escalated', label: 'Escalated' };
      case 'RESOLVED':
        return { icon: <CheckCircle size={12} />, className: 'resolved', label: 'Resolved' };
      case 'REVIEW_APPROVED':
        return { icon: <CheckSquare size={12} />, className: 'review', label: 'Manager Approved' };
      case 'REVIEW_REOPENED':
        return { icon: <ArrowUpRight size={12} />, className: 'escalated', label: 'Reopened' };
      case 'FEEDBACK_SUBMITTED':
        return { icon: <Star size={12} />, className: 'feedback', label: 'Feedback' };
      case 'CLOSED':
        return { icon: <Lock size={12} />, className: 'closed', label: 'Closed' };
      case 'ATTACHMENT_ADDED':
        return { icon: <Paperclip size={12} />, className: 'assigned', label: 'Attachment' };
      default:
        return { icon: <FileText size={12} />, className: 'assigned', label: 'Note' };
    }
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (!items || items.length === 0) {
    return <div style={{ color: '#94a3b8', fontSize: 13 }}>No activity recorded yet.</div>;
  }

  return (
    <div className="timeline">
      {items.map((item) => {
        const config = getActionConfig(item.action_type);
        return (
          <div key={item.id} className="timeline-item">
            <div className={`timeline-dot ${config.className}`}>{config.icon}</div>
            <div className="timeline-header">
              <span className="timeline-title">{item.title}</span>
              <span className="timeline-time">{formatDate(item.created_at)}</span>
            </div>
            {item.description && <div className="timeline-desc">{item.description}</div>}
            {item.actor_email && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                By: {item.actor_email} {item.actor_role ? `(${item.actor_role})` : ''}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
