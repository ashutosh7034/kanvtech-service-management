import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Ticket } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SLABadge } from '../../components/common/SLABadge';
import { ResolutionTimerWidget } from '../../components/tickets/ResolutionTimerWidget';
import { TicketTimeline } from '../../components/tickets/TicketTimeline';
import {
  ArrowLeft,
  Play,
  ArrowUpRight,
  CheckCircle,
  CheckSquare,
  RotateCcw,
  MessageSquare,
  Paperclip,
  Star,
  Building,
  User,
  Phone,
  Mail,
  FileText,
  AlertTriangle,
  Copy,
  Check,
  Lock,
} from 'lucide-react';

import { formatDateTime, formatDate } from '../../utils/date';

interface Props {
  ticketId: string;
  onBack: () => void;
}

export const TicketDetailPage: React.FC<Props> = ({ ticketId, onBack }) => {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modals / Action States
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [escalateNotes, setEscalateNotes] = useState('');
  const [escalating, setEscalating] = useState(false);

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopening, setReopening] = useState(false);

  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState<'INTERNAL_NOTE' | 'CUSTOMER_COMMUNICATION'>('INTERNAL_NOTE');
  const [commenting, setCommenting] = useState(false);

  // Feedback State
  const [rating, setRating] = useState(5);
  const [feedbackRemarks, setFeedbackRemarks] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = () => {
    if (ticket?.id) {
      navigator.clipboard.writeText(ticket.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  const loadTicket = async () => {
    try {
      const res = await api.getTicket(ticketId);
      setTicket(res.ticket);
    } catch (err: any) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleStartWork = async () => {
    try {
      await api.startWork(ticketId);
      showToast('Resolution session initiated. Timer started.', 'success');
      loadTicket();
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  const handleEscalate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) return;

    let toLevel: 'L2' | 'L3' | 'PARENT_COMPANY' = 'L2';
    if (ticket.assigned_level === 'L2') toLevel = 'L3';
    if (ticket.assigned_level === 'L3') toLevel = 'PARENT_COMPANY';

    setEscalating(true);
    try {
      await api.escalateTicket(ticketId, {
        fromLevel: ticket.assigned_level,
        toLevel,
        reason: escalateReason,
        notes: escalateNotes,
      });
      setShowEscalateModal(false);
      setEscalateReason('');
      setEscalateNotes('');
      showToast(`Ticket escalated to ${toLevel}. Work session transferred.`, 'success');
      loadTicket();
    } catch (err: any) {
      showToast(err.message, 'danger');
    } finally {
      setEscalating(false);
    }
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    setResolving(true);
    try {
      await api.resolveTicket(ticketId, { resolutionNotes });
      setShowResolveModal(false);
      setResolutionNotes('');
      showToast('Technical resolution submitted. Ticket transitioned to Customer Verification.', 'success');
      loadTicket();
    } catch (err: any) {
      showToast(err.message, 'danger');
    } finally {
      setResolving(false);
    }
  };

  const handleApprove = async () => {
    try {
      await api.approveTicket(ticketId, { notes: 'Manager verified and approved resolution.' });
      showToast('Resolution approved. Customer feedback request sent.', 'success');
      loadTicket();
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  const handleReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenReason.trim()) {
      alert('Please provide a reason for reopening the ticket');
      return;
    }
    setReopening(true);
    try {
      await api.reopenTicket(ticketId, { reason: reopenReason });
      setShowReopenModal(false);
      setReopenReason('');
      showToast('Ticket reopened and returned to active support.', 'info');
      loadTicket();
    } catch (err: any) {
      showToast(err.message, 'danger');
    } finally {
      setReopening(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingFeedback(true);
    try {
      await api.submitFeedback(ticketId, { rating, remarks: feedbackRemarks });
      showToast('Feedback submitted and ticket closed successfully.', 'success');
      loadTicket();
    } catch (err: any) {
      showToast(err.message, 'danger');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setCommenting(true);
    try {
      await api.addComment(ticketId, { message: newComment, commentType });
      setNewComment('');
      showToast('Note recorded.', 'success');
      loadTicket();
    } catch (err: any) {
      showToast(err.message, 'danger');
    } finally {
      setCommenting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.uploadAttachment(ticketId, formData);
      showToast(`Attachment ${file.name} uploaded.`, 'success');
      loadTicket();
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  if (loading || !ticket) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading ticket work screen...</div>;
  }

  const isAssignedToMe = user?.employeeId === ticket.assigned_employee_id;
  const isManagerOrAdmin = ['ADMIN', 'MANAGER'].includes(user?.role || '');
  const canWork = isAssignedToMe || isManagerOrAdmin;
  const isCustomer = user?.role === 'CUSTOMER';
  const isCustomerOwner = isCustomer && user?.companyId === ticket.company_id;
  const isReopenEligible = ['MANAGER_REVIEW', 'CUSTOMER_FEEDBACK', 'RESOLVED', 'CLOSED'].includes(ticket.status);

  return (
    <div>
      {/* Top Breadcrumb & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack}>
          <ArrowLeft size={14} /> Back to Tickets
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          {/* Customer Reopen Button */}
          {isCustomerOwner && isReopenEligible && ticket.status !== 'IN_PROGRESS' && (
            <button className="btn btn-danger btn-sm" onClick={() => setShowReopenModal(true)}>
              <RotateCcw size={14} /> Reopen Ticket
            </button>
          )}

          {canWork && ticket.status === 'OPEN' && (
            <button className="btn btn-primary" onClick={handleStartWork}>
              <Play size={14} /> Start Work
            </button>
          )}

          {canWork && (ticket.status === 'IN_PROGRESS' || ticket.status === 'REOPENED') && (
            <>
              {ticket.assigned_level !== 'PARENT_COMPANY' && (
                <button className="btn btn-secondary" onClick={() => setShowEscalateModal(true)}>
                  <ArrowUpRight size={14} /> Escalate Tier
                </button>
              )}
              <button className="btn btn-success" onClick={() => setShowResolveModal(true)}>
                <CheckCircle size={14} /> Mark Resolved
              </button>
            </>
          )}

          {isManagerOrAdmin && ticket.status === 'MANAGER_REVIEW' && (
            <>
              <button className="btn btn-danger" onClick={() => setShowReopenModal(true)}>
                <RotateCcw size={14} /> Reopen / Send Back
              </button>
              <button className="btn btn-success" onClick={handleApprove}>
                <CheckSquare size={14} /> Approve Resolution
              </button>
            </>
          )}
        </div>
      </div>

      {/* Ticket Banner / Header */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--brand-primary)' }}>
                {ticket.id}
              </span>
              <button
                onClick={handleCopyId}
                className="btn btn-secondary btn-sm"
                style={{ padding: '2px 8px', fontSize: 11, height: 24 }}
                title="Copy Ticket ID to clipboard"
              >
                {copiedId ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                <span>{copiedId ? 'Copied' : 'Copy'}</span>
              </button>
              <StatusBadge status={ticket.status} />
              <span className={`priority-${ticket.priority.toLowerCase()}`} style={{ fontWeight: 600 }}>
                ● {ticket.priority} Priority
              </span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 6, color: '#0f172a' }}>
              {ticket.problem_type}
            </h3>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Category: <strong>{ticket.category}</strong> • Opened on {formatDateTime(ticket.created_at)}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ marginBottom: 4 }}>
              <SLABadge status={ticket.computedSLA?.status || ticket.sla_status} remainingSeconds={ticket.computedSLA?.remainingSeconds} />
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Deadline: {formatDateTime(ticket.sla_deadline)}
            </div>
          </div>
        </div>
      </div>

      {/* Customer Verification & Feedback Prompt Banner (Customer Interactive View) */}
      {(ticket.status === 'CUSTOMER_FEEDBACK' || ticket.status === 'RESOLVED') && isCustomerOwner && !ticket.feedback && (
        <div
          style={{
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: 8,
            padding: '16px 20px',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, color: '#9a3412', fontSize: 15, marginBottom: 4 }}>
                Customer Verification & CSAT Feedback
              </div>
              <div style={{ fontSize: 13, color: '#7c2d12', marginBottom: 12 }}>
                Technical resolution has been submitted. Please test the solution. If satisfied, provide your service rating and close the ticket. If the problem persists, click "Reopen Ticket".
              </div>
            </div>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => setShowReopenModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RotateCcw size={13} />
              Problem Not Solved? Reopen Ticket
            </button>
          </div>

          <form onSubmit={handleFeedbackSubmit}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#431407' }}>Service Rating:</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: star <= rating ? '#ea580c' : '#cbd5e1',
                      padding: 2,
                    }}
                  >
                    <Star size={24} fill={star <= rating ? '#ea580c' : 'none'} />
                  </button>
                ))}
              </div>
              <span style={{ fontWeight: 700, color: '#9a3412' }}>{rating} / 5 Stars</span>
            </div>

            <div className="form-group" style={{ marginBottom: 10 }}>
              <input
                type="text"
                className="form-control"
                placeholder="Optional remarks regarding resolution quality, timeliness, or technician support..."
                value={feedbackRemarks}
                onChange={(e) => setFeedbackRemarks(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-sm" disabled={submittingFeedback}>
              {submittingFeedback ? 'Submitting...' : 'Submit Feedback & Close Ticket'}
            </button>
          </form>
        </div>
      )}

      {/* Staff View: Awaiting Customer Verification (Read-Only Info Banner for Admins/Managers/Employees) */}
      {(ticket.status === 'CUSTOMER_FEEDBACK' || ticket.status === 'RESOLVED') && !isCustomer && !ticket.feedback && (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 8,
            padding: '14px 18px',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: '#166534', fontSize: 14 }}>
              Technical Resolution Completed • Awaiting Customer Verification
            </div>
            <div style={{ fontSize: 13, color: '#14532d', marginTop: 2 }}>
              Technical work has been delivered to the customer. Awaiting customer testing, CSAT rating, or reopen request.
            </div>
          </div>
          {isManagerOrAdmin && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowReopenModal(true)}>
              <RotateCcw size={13} /> Reopen Ticket
            </button>
          )}
        </div>
      )}

      {/* Closed State Banner */}
      {ticket.status === 'CLOSED' && (
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            padding: '14px 18px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <span style={{ fontWeight: 700, color: '#334155' }}>Ticket Formally Closed</span>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Closed on {formatDateTime(ticket.closed_at)}. {ticket.closure_reason ? `Reason: ${ticket.closure_reason}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {ticket.feedback && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ea580c', fontWeight: 700 }}>
                  <Star size={16} fill="#ea580c" />
                  <span>{ticket.feedback.rating} / 5 Stars</span>
                </div>
                {ticket.feedback.remarks && (
                  <div style={{ fontSize: 11, color: '#64748b' }}>"{ticket.feedback.remarks}"</div>
                )}
              </div>
            )}
            {isCustomer && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowReopenModal(true)}
                title="Reopen ticket if issue recurred"
              >
                <RotateCcw size={13} /> Reopen Ticket
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Grid: Work Information Left, Timeline & Timer Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: 20 }}>
        {/* Left Column */}
        <div>
          {/* Customer & Company Card */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title">Customer & Organization</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
                  <Building size={14} /> Organization
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}>{ticket.company_name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Account ID: {ticket.company_id}</div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
                  <User size={14} /> Contact Person
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}>{ticket.contact_name}</div>
                <div style={{ fontSize: 12, color: '#475569' }}>{ticket.contact_phone}</div>
                <div style={{ fontSize: 12, color: '#475569' }}>{ticket.contact_email}</div>
              </div>
            </div>
          </div>

          {/* Assigned Specialist & Tier */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title">Assigned Support Specialist</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {ticket.assigned_employee_name || 'Currently Unassigned'}
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {isCustomer ? `Support Tier: ${ticket.assigned_level}` : (ticket.assigned_employee_email || 'Awaiting manual or auto triage')}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: 4,
                    fontWeight: 700,
                    fontSize: 12,
                    background: '#e0f2fe',
                    color: '#0369a1',
                    border: '1px solid #7dd3fc',
                  }}
                >
                  Current Tier: {ticket.assigned_level}
                </span>
              </div>
            </div>
          </div>

          {/* Problem Description */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title">Problem Description</div>
            </div>
            <div style={{ fontSize: 14, color: '#1e293b', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {ticket.description}
            </div>
          </div>

          {/* Attachments Section */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title">Diagnostic Attachments</div>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                <Paperclip size={13} /> Attach File
                <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>

            {ticket.attachments && ticket.attachments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ticket.attachments.map((att: any) => (
                  <div
                    key={att.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: '#f8fafc',
                      borderRadius: 6,
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={16} color="#0284c7" />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{att.file_name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {Math.round(att.file_size / 1024)} KB • Uploaded by {att.uploaded_by_email}
                        </div>
                      </div>
                    </div>
                    <a
                      href={att.file_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      Download
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>No diagnostic files attached.</div>
            )}
          </div>

          {/* Comments & Work Notes */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Work Notes & Communications</div>
            </div>

            {ticket.status !== 'CLOSED' && (
              <form onSubmit={handleAddComment} style={{ marginBottom: 16 }}>
                {!isCustomer ? (
                  <>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      <button
                        type="button"
                        onClick={() => setCommentType('INTERNAL_NOTE')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '5px 12px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: commentType === 'INTERNAL_NOTE' ? '1px solid #d97706' : '1px solid var(--border-medium)',
                          background: commentType === 'INTERNAL_NOTE' ? '#fffbeb' : '#f8fafc',
                          color: commentType === 'INTERNAL_NOTE' ? '#b45309' : '#64748b',
                        }}
                      >
                        <Lock size={12} />
                        <span>Internal Specialist Note</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCommentType('CUSTOMER_COMMUNICATION')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '5px 12px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: commentType === 'CUSTOMER_COMMUNICATION' ? '1px solid #2563eb' : '1px solid var(--border-medium)',
                          background: commentType === 'CUSTOMER_COMMUNICATION' ? '#eff6ff' : '#f8fafc',
                          color: commentType === 'CUSTOMER_COMMUNICATION' ? '#1d4ed8' : '#64748b',
                        }}
                      >
                        <MessageSquare size={12} />
                        <span>Customer Communication</span>
                      </button>
                    </div>

                    <div style={{ fontSize: 11, color: commentType === 'INTERNAL_NOTE' ? '#b45309' : '#1d4ed8', marginBottom: 6, fontWeight: 500 }}>
                      {commentType === 'INTERNAL_NOTE' 
                        ? 'Confidential: Internal specialist note. Not visible to customer organization.' 
                        : 'Customer update: Directly visible to client contact on their portal.'}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: '#1d4ed8', marginBottom: 8, fontWeight: 600 }}>
                    Post a message or update to the assigned engineering team:
                  </div>
                )}

                <textarea
                  className="form-control"
                  rows={3}
                  style={{
                    borderColor: (!isCustomer && commentType === 'INTERNAL_NOTE') ? '#fde68a' : '#bfdbfe',
                    backgroundColor: (!isCustomer && commentType === 'INTERNAL_NOTE') ? '#fffdf7' : '#fbfdff',
                  }}
                  placeholder={
                    isCustomer
                      ? 'Type your message or additional inquiry details here...'
                      : commentType === 'INTERNAL_NOTE'
                      ? 'Record internal troubleshooting steps, root cause diagnosis, hardware serials, or tier handover details...'
                      : 'Provide a clear, professional progress update or resolution explanation for the client...'
                  }
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={commenting || !newComment.trim()}
                  >
                    {commenting ? 'Saving...' : isCustomer ? 'Send Message' : commentType === 'INTERNAL_NOTE' ? 'Post Internal Note' : 'Send Customer Update'}
                  </button>
                </div>
              </form>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(() => {
                const visibleComments = isCustomer
                  ? (ticket.comments || []).filter((cm: any) => cm.comment_type === 'CUSTOMER_COMMUNICATION')
                  : (ticket.comments || []);

                return visibleComments.length > 0 ? (
                  visibleComments.map((cm: any) => (
                    <div
                      key={cm.id}
                    style={{
                      background: cm.comment_type === 'INTERNAL_NOTE' ? '#fffdf5' : '#f8fafc',
                      border: cm.comment_type === 'INTERNAL_NOTE' ? '1px solid #fef3c7' : '1px solid #e2e8f0',
                      borderRadius: 6,
                      padding: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>{cm.author_email}</span>
                        <span style={{ fontSize: 11, color: '#64748b' }}>({cm.author_role})</span>
                        {cm.comment_type === 'INTERNAL_NOTE' ? (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                            Internal Note
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                            Customer Update
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>
                        {formatDateTime(cm.created_at)}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {cm.message}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 12, color: '#94a3b8' }}>No notes logged yet.</div>
              );
            })()}
            </div>
          </div>
        </div>

        {/* Right Column: Timer & Timeline & Reopen History */}
        <div>
          {/* Continuous Resolution Timer Widget */}
          <ResolutionTimerWidget
            initialSeconds={ticket.timer?.totalSeconds || ticket.total_resolution_seconds || 0}
            isRunning={ticket.timer?.isRunning || false}
            sessions={ticket.timer?.sessions || []}
            canControl={canWork}
            onStart={handleStartWork}
          />

          {/* Reopen History Card (if any reopens occurred) */}
          {(ticket.reopen_history || ticket.reopenHistory || []).length > 0 && (
            <div className="card" style={{ marginTop: 16, borderLeft: '4px solid #ef4444' }}>
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <RotateCcw size={14} color="#ef4444" />
                <div className="card-title" style={{ color: '#b91c1c' }}>Ticket Reopen History</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                {(ticket.reopen_history || ticket.reopenHistory || []).map((rh: any, idx: number) => (
                  <div key={rh.id || idx} style={{ padding: 10, background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#991b1b' }}>
                      <span>Reopened by: {rh.reopened_by_email || `User #${rh.reopened_by}`}</span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{formatDateTime(rh.created_at)}</span>
                    </div>
                    <div style={{ marginTop: 4, color: '#450a0a', fontStyle: 'italic' }}>
                      "{rh.reopen_reason}"
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chronological Audit Timeline */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <div className="card-title">Chronological Audit Timeline</div>
            </div>
            <TicketTimeline items={ticket.timeline || []} />
          </div>
        </div>
      </div>

      {/* Escalate Modal */}
      {showEscalateModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-title">
                Escalate Ticket: {ticket.assigned_level} → {ticket.assigned_level === 'L1' ? 'L2' : ticket.assigned_level === 'L2' ? 'L3' : 'Parent Company'}
              </div>
              <button onClick={() => setShowEscalateModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>
                ✕
              </button>
            </div>
            <form onSubmit={handleEscalate}>
              <div className="modal-body">
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: 10, borderRadius: 6, fontSize: 12, color: '#b45309', marginBottom: 14 }}>
                  Escalation transfers resolution to the next support tier. The active session timer is logged and preserved continuously.
                </div>
                <div className="form-group">
                  <label className="form-label">Escalation Reason <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. Requires firmware diagnostic permissions"
                    value={escalateReason}
                    onChange={(e) => setEscalateReason(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Detailed Notes for Next Specialist Tier</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Summarize steps already attempted, error outputs, and recommended actions..."
                    value={escalateNotes}
                    onChange={(e) => setEscalateNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEscalateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={escalating}>
                  {escalating ? 'Escalating...' : 'Confirm Escalation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-title">Resolve Service Ticket</div>
              <button onClick={() => setShowResolveModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>
                ✕
              </button>
            </div>
            <form onSubmit={handleResolve}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Root Cause & Resolution Summary <span className="required">*</span></label>
                  <textarea
                    className="form-control"
                    required
                    rows={4}
                    placeholder="Document root cause identified, corrective actions performed, and verification steps taken..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                  />
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Marking resolved records your resolution notes, pauses the active timer, and submits the ticket for Manager Review.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowResolveModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" disabled={resolving}>
                  {resolving ? 'Submitting...' : 'Submit Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reopen Modal */}
      {showReopenModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-title">Reopen / Send Back Resolution</div>
              <button onClick={() => setShowReopenModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>
                ✕
              </button>
            </div>
            <form onSubmit={handleReopen}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Reason for Reopening <span className="required">*</span></label>
                  <textarea
                    className="form-control"
                    required
                    rows={3}
                    placeholder="Specify why the technical resolution is incomplete or what additional tests are needed..."
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowReopenModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" disabled={reopening}>
                  {reopening ? 'Reopening...' : 'Reopen Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
