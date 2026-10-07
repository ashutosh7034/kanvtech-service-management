import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import {
  Mail,
  Send,
  Inbox,
  Search,
  Plus,
  X,
  CornerUpLeft,
  ReplyAll,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { formatDateTime, formatTime } from '../../utils/date';

interface EmployeeRecipient {
  userId: number;
  email: string;
  name: string;
  designation?: string;
  department?: string;
  role: string;
}

interface ChatPageProps {
  initialConversationId?: number;
}

export const ChatPage: React.FC<ChatPageProps> = ({ initialConversationId }) => {
  const { user } = useAuth();
  const { showToast, refreshNotifications } = useNotifications();

  // Navigation & Folder state
  const [folder, setFolder] = useState<'inbox' | 'sent' | 'unread'>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
  const [loadingList, setLoadingList] = useState(true);

  // Compose Modal state
  const [showCompose, setShowCompose] = useState(false);
  const [availableEmployees, setAvailableEmployees] = useState<EmployeeRecipient[]>([]);
  const [toRecipients, setToRecipients] = useState<EmployeeRecipient[]>([]);
  const [ccRecipients, setCcRecipients] = useState<EmployeeRecipient[]>([]);
  const [toSearch, setToSearch] = useState('');
  const [ccSearch, setCcSearch] = useState('');
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [showCcDropdown, setShowCcDropdown] = useState(false);
  const [subject, setSubject] = useState('');
  const [bodyMessage, setBodyMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Reply state
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [isReplyAll, setIsReplyAll] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toDropdownRef = useRef<HTMLDivElement>(null);
  const ccDropdownRef = useRef<HTMLDivElement>(null);

  // Load available employees on mount
  useEffect(() => {
    if (user?.role === 'CUSTOMER') return;
    loadEmployees();
    loadConversations();
  }, [user]);

  // Handle folder or search change
  useEffect(() => {
    if (user?.role === 'CUSTOMER') return;
    loadConversations();
  }, [folder, searchQuery]);

  // Handle initial conversation ID if provided
  useEffect(() => {
    if (initialConversationId) {
      loadConversationDetails(initialConversationId);
    }
  }, [initialConversationId]);

  // Auto-refresh conversations periodically
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations(true);
      if (selectedConversation) {
        loadConversationDetails(selectedConversation.id, true);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [folder, searchQuery, selectedConversation?.id]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversation?.messages]);

  const loadEmployees = async () => {
    try {
      const emps = await api.getInternalEmployees();
      setAvailableEmployees(emps || []);
    } catch (err) {
      console.error('Failed to load employees for messaging:', err);
    }
  };

  const loadConversations = async (silent = false) => {
    if (!silent) setLoadingList(true);
    try {
      const convs = await api.getConversations({ folder, search: searchQuery });
      setConversations(convs || []);
    } catch (err: any) {
      if (!silent) showToast(err.message || 'Failed to load conversations', 'danger');
    } finally {
      if (!silent) setLoadingList(false);
    }
  };

  const loadConversationDetails = async (convId: number, silent = false) => {
    try {
      const details = await api.getConversationDetails(convId);
      setSelectedConversation(details);
      // Mark as read in backend
      await api.markMessagesRead(convId);
      // Update local unread state
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
      );
      refreshNotifications();
    } catch (err: any) {
      if (!silent) showToast(err.message || 'Failed to load conversation details', 'danger');
    }
  };

  const handleOpenCompose = () => {
    setToRecipients([]);
    setCcRecipients([]);
    setToSearch('');
    setCcSearch('');
    setSubject('');
    setBodyMessage('');
    setShowCompose(true);
  };

  const handleSendCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (toRecipients.length === 0) {
      showToast('Please specify at least one "To" recipient.', 'danger');
      return;
    }
    if (!subject.trim()) {
      showToast('Please enter a message subject.', 'danger');
      return;
    }
    if (!bodyMessage.trim()) {
      showToast('Message body cannot be empty.', 'danger');
      return;
    }

    setIsSending(true);
    try {
      const res = await api.composeMessage({
        toUserIds: toRecipients.map((r) => r.userId),
        ccUserIds: ccRecipients.map((r) => r.userId),
        subject: subject.trim(),
        message: bodyMessage.trim(),
      });

      showToast('Internal message sent successfully.', 'success');
      setShowCompose(false);
      setToRecipients([]);
      setCcRecipients([]);
      setSubject('');
      setBodyMessage('');

      await loadConversations();
      if (res?.conversationId) {
        await loadConversationDetails(res.conversationId);
      }
      refreshNotifications();
    } catch (err: any) {
      showToast(err.message || 'Failed to send message', 'danger');
    } finally {
      setIsSending(false);
    }
  };

  const handleInitiateReply = (replyAllMode: boolean) => {
    setIsReplyAll(replyAllMode);
    setReplyText('');
    setShowReplyBox(true);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedConversation) return;

    setIsReplying(true);
    try {
      await api.replyMessage(selectedConversation.id, {
        message: replyText.trim(),
        isReplyAll,
      });

      setReplyText('');
      setShowReplyBox(false);
      showToast(isReplyAll ? 'Reply All sent successfully.' : 'Reply sent successfully.', 'success');
      await loadConversationDetails(selectedConversation.id);
      await loadConversations(true);
      refreshNotifications();
    } catch (err: any) {
      showToast(err.message || 'Failed to send reply', 'danger');
    } finally {
      setIsReplying(false);
    }
  };

  // Helper filters for employee picker
  const filteredToEmployees = availableEmployees.filter(
    (emp) =>
      !toRecipients.some((r) => r.userId === emp.userId) &&
      !ccRecipients.some((r) => r.userId === emp.userId) &&
      (emp.name.toLowerCase().includes(toSearch.toLowerCase()) ||
        emp.email.toLowerCase().includes(toSearch.toLowerCase()) ||
        emp.designation?.toLowerCase().includes(toSearch.toLowerCase()))
  );

  const filteredCcEmployees = availableEmployees.filter(
    (emp) =>
      !toRecipients.some((r) => r.userId === emp.userId) &&
      !ccRecipients.some((r) => r.userId === emp.userId) &&
      (emp.name.toLowerCase().includes(ccSearch.toLowerCase()) ||
        emp.email.toLowerCase().includes(ccSearch.toLowerCase()) ||
        emp.designation?.toLowerCase().includes(ccSearch.toLowerCase()))
  );

  const totalUnreadConversations = conversations.filter((c) => c.unreadCount > 0).length;

  if (user?.role === 'CUSTOMER') {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
        <AlertCircle size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
        <h3 style={{ fontSize: 18, color: '#0f172a' }}>Internal Messaging Restricted</h3>
        <p style={{ fontSize: 13, marginTop: 4 }}>
          Internal messaging is reserved exclusively for authenticated Kanvtech employees.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', height: 'calc(100vh - 110px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Mail size={24} color="#0284c7" />
            Internal Messages
          </h1>
          <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 0' }}>
            Internal company mail & message threads. No external emails or third-party delivery.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleOpenCompose}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, padding: '8px 16px' }}
        >
          <Plus size={16} /> Compose
        </button>
      </div>

      {/* Main Mailbox Grid: Folder Sidebar + Thread List + Thread Details */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '200px 360px 1fr',
          gap: 16,
          flex: 1,
          minHeight: 0,
          background: '#ffffff',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        {/* 1. Folders Navigation Column */}
        <div style={{ background: '#f8fafc', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', padding: '16px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, paddingLeft: 8 }}>
            Folders
          </div>

          <button
            onClick={() => { setFolder('inbox'); setSelectedConversation(null); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 12px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: folder === 'inbox' ? '#e0f2fe' : 'transparent',
              color: folder === 'inbox' ? '#0369a1' : '#334155',
              fontWeight: folder === 'inbox' ? 700 : 500,
              fontSize: 13,
              marginBottom: 4,
              textAlign: 'left',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Inbox size={16} /> Inbox
            </span>
            {totalUnreadConversations > 0 && (
              <span style={{ background: '#0284c7', color: '#fff', fontSize: 11, padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
                {totalUnreadConversations}
              </span>
            )}
          </button>

          <button
            onClick={() => { setFolder('sent'); setSelectedConversation(null); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 12px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: folder === 'sent' ? '#e0f2fe' : 'transparent',
              color: folder === 'sent' ? '#0369a1' : '#334155',
              fontWeight: folder === 'sent' ? 700 : 500,
              fontSize: 13,
              marginBottom: 4,
              textAlign: 'left',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Send size={16} /> Sent
            </span>
          </button>

          <button
            onClick={() => { setFolder('unread'); setSelectedConversation(null); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 12px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: folder === 'unread' ? '#e0f2fe' : 'transparent',
              color: folder === 'unread' ? '#0369a1' : '#334155',
              fontWeight: folder === 'unread' ? 700 : 500,
              fontSize: 13,
              textAlign: 'left',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mail size={16} /> Unread
            </span>
            {totalUnreadConversations > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', fontSize: 11, padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
                {totalUnreadConversations}
              </span>
            )}
          </button>

          <div style={{ marginTop: 'auto', padding: '12px 8px', borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
            🔒 Private & Confidential to message participants only.
          </div>
        </div>

        {/* 2. Message Thread List Column */}
        <div style={{ borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Search Input */}
          <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search subject, sender, or content..."
                style={{ paddingLeft: 32, fontSize: 12, height: 34 }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Conversations Scrollable List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingList ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                Loading messages...
              </div>
            ) : conversations.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                <Inbox size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>No messages found</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>
                  {folder === 'sent' ? 'You have not sent any internal messages.' : 'Your mailbox is empty.'}
                </div>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = selectedConversation?.id === conv.id;
                const isUnread = conv.unreadCount > 0;
                const latestMsg = conv.latestMessage;
                const senderName = latestMsg?.sender?.employee?.name || latestMsg?.sender?.email || 'Employee';

                return (
                  <div
                    key={conv.id}
                    onClick={() => loadConversationDetails(conv.id)}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid #f1f5f9',
                      background: isSelected ? '#eff6ff' : isUnread ? '#f8fafc' : '#ffffff',
                      borderLeft: isSelected ? '3px solid #0284c7' : isUnread ? '3px solid #38bdf8' : '3px solid transparent',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isUnread && (
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0284c7', display: 'inline-block' }} />
                        )}
                        <span style={{ fontSize: 13, fontWeight: isUnread ? 700 : 600, color: '#0f172a' }}>
                          {senderName}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>
                        {latestMsg?.createdAt ? formatTime(latestMsg.createdAt) : ''}
                      </span>
                    </div>

                    <div style={{ fontSize: 13, fontWeight: isUnread ? 700 : 500, color: '#1e293b', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.title || '(No Subject)'}
                    </div>

                    <div style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {latestMsg?.message || 'Empty message body'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 3. Thread Detail View Column */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ffffff' }}>
          {!selectedConversation ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', padding: 32, textAlign: 'center' }}>
              <FileText size={48} color="#cbd5e1" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b' }}>No Conversation Selected</div>
              <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 360, marginTop: 6 }}>
                Select a message thread from the left to view the complete conversation history, or click <strong>Compose</strong> to start a new internal message.
              </p>
            </div>
          ) : (
            <>
              {/* Thread Header Banner */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    {selectedConversation.title || '(No Subject)'}
                  </h2>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleInitiateReply(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                    >
                      <CornerUpLeft size={13} /> Reply
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleInitiateReply(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                    >
                      <ReplyAll size={13} /> Reply All
                    </button>
                  </div>
                </div>

                {/* Participants Metadata Info */}
                <div style={{ fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <strong style={{ color: '#0f172a', minWidth: 45 }}>From:</strong>
                    <span>
                      {selectedConversation.messages?.[0]?.sender?.employee?.name || selectedConversation.messages?.[0]?.sender?.email || 'Unknown'}
                      {' '}&lt;{selectedConversation.messages?.[0]?.sender?.email}&gt;
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <strong style={{ color: '#0f172a', minWidth: 45 }}>To:</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {selectedConversation.participants
                        ?.filter((p: any) => p.user?.id !== selectedConversation.messages?.[0]?.senderId)
                        .map((p: any) => (
                          <span
                            key={p.id}
                            style={{
                              background: '#f1f5f9',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              color: '#334155',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            {p.user?.employee?.name || p.user?.email}
                          </span>
                        ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 11, color: '#94a3b8' }}>
                    <strong style={{ color: '#64748b', minWidth: 45 }}>Date:</strong>
                    <span>{formatDateTime(selectedConversation.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Messages Chronological Thread */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {selectedConversation.messages?.map((msg: any) => {
                  const isMe = msg.senderId === user?.id;
                  const senderName = msg.sender?.employee?.name || msg.sender?.email || 'Employee';
                  const designation = msg.sender?.employee?.designation || msg.sender?.role;

                  return (
                    <div
                      key={msg.id}
                      style={{
                        background: isMe ? '#f8fafc' : '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        padding: '16px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: isMe ? '#e0f2fe' : '#f1f5f9',
                              color: isMe ? '#0284c7' : '#475569',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            {senderName[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                              {senderName} {isMe && <span style={{ color: '#0284c7', fontSize: 11 }}>(You)</span>}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>
                              {msg.sender?.email} {designation ? `• ${designation}` : ''}
                            </div>
                          </div>
                        </div>

                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                          {formatDateTime(msg.createdAt)}
                        </div>
                      </div>

                      {/* Message Content */}
                      <div style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {msg.message}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* In-Line Reply Box */}
              {showReplyBox && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', background: '#fafafa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isReplyAll ? <ReplyAll size={14} /> : <CornerUpLeft size={14} />}
                      {isReplyAll
                        ? `Replying to All (${selectedConversation.participants?.length || 0} participants)`
                        : `Replying to ${selectedConversation.messages?.[selectedConversation.messages.length - 1]?.sender?.employee?.name || 'sender'}`}
                    </div>
                    <button
                      onClick={() => setShowReplyBox(false)}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 2 }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <form onSubmit={handleSendReply}>
                    <textarea
                      className="form-control"
                      rows={4}
                      placeholder="Type your reply here..."
                      style={{ fontSize: 13, resize: 'vertical', marginBottom: 10 }}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      autoFocus
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowReplyBox(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        disabled={isReplying || !replyText.trim()}
                        style={{ minWidth: 100 }}
                      >
                        {isReplying ? 'Sending...' : 'Send Reply'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. COMPOSE MESSAGE MODAL (Email-Style)                     */}
      {/* ========================================================= */}
      {showCompose && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: 20,
          }}
          onClick={() => setShowCompose(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 680, padding: 0, background: '#ffffff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>New Internal Message</h3>
              </div>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#64748b' }}
                onClick={() => setShowCompose(false)}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSendCompose} style={{ padding: '20px' }}>
              {/* Internal Helper Notice */}
              <div style={{ padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12, color: '#1e40af', marginBottom: 14 }}>
                ℹ️ <strong>Internal Delivery Only:</strong> This message will be saved inside Kanvtech and in-app notifications will be generated for selected employees. No external emails are sent.
              </div>

              {/* TO Field */}
              <div style={{ marginBottom: 12, position: 'relative' }} ref={toDropdownRef}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  To (Internal Employees) *
                </label>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    background: '#ffffff',
                    minHeight: 38,
                  }}
                  onClick={() => setShowToDropdown(true)}
                >
                  {toRecipients.map((emp) => (
                    <span
                      key={emp.userId}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: '#e0f2fe',
                        color: '#0369a1',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {emp.name}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setToRecipients(toRecipients.filter((r) => r.userId !== emp.userId));
                        }}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#0369a1' }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder={toRecipients.length === 0 ? 'Type employee name or email to select...' : 'Add more...'}
                    value={toSearch}
                    onChange={(e) => {
                      setToSearch(e.target.value);
                      setShowToDropdown(true);
                    }}
                    onFocus={() => setShowToDropdown(true)}
                    style={{
                      border: 'none',
                      outline: 'none',
                      flex: 1,
                      minWidth: 140,
                      fontSize: 13,
                    }}
                  />
                </div>

                {/* Dropdown Options */}
                {showToDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      zIndex: 100,
                      maxHeight: 180,
                      overflowY: 'auto',
                      marginTop: 4,
                    }}
                  >
                    {filteredToEmployees.length === 0 ? (
                      <div style={{ padding: 10, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                        No matching active employees
                      </div>
                    ) : (
                      filteredToEmployees.map((emp) => (
                        <div
                          key={emp.userId}
                          onMouseDown={() => {
                            setToRecipients([...toRecipients, emp]);
                            setToSearch('');
                            setShowToDropdown(false);
                          }}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: 12,
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                        >
                          <div>
                            <strong style={{ color: '#0f172a' }}>{emp.name}</strong>
                            <span style={{ color: '#64748b', marginLeft: 6 }}>&lt;{emp.email}&gt;</span>
                          </div>
                          <span style={{ fontSize: 10, color: '#0284c7', background: '#e0f2fe', padding: '1px 6px', borderRadius: 4 }}>
                            {emp.designation || emp.role}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* CC Field */}
              <div style={{ marginBottom: 12, position: 'relative' }} ref={ccDropdownRef}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  Cc (Optional)
                </label>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    background: '#ffffff',
                    minHeight: 38,
                  }}
                  onClick={() => setShowCcDropdown(true)}
                >
                  {ccRecipients.map((emp) => (
                    <span
                      key={emp.userId}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: '#f1f5f9',
                        color: '#475569',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      {emp.name}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCcRecipients(ccRecipients.filter((r) => r.userId !== emp.userId));
                        }}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#475569' }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder={ccRecipients.length === 0 ? 'Type employee name or email for CC...' : 'Add more CC...'}
                    value={ccSearch}
                    onChange={(e) => {
                      setCcSearch(e.target.value);
                      setShowCcDropdown(true);
                    }}
                    onFocus={() => setShowCcDropdown(true)}
                    style={{
                      border: 'none',
                      outline: 'none',
                      flex: 1,
                      minWidth: 140,
                      fontSize: 13,
                    }}
                  />
                </div>

                {/* Dropdown Options for CC */}
                {showCcDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      zIndex: 100,
                      maxHeight: 180,
                      overflowY: 'auto',
                      marginTop: 4,
                    }}
                  >
                    {filteredCcEmployees.length === 0 ? (
                      <div style={{ padding: 10, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                        No matching active employees
                      </div>
                    ) : (
                      filteredCcEmployees.map((emp) => (
                        <div
                          key={emp.userId}
                          onMouseDown={() => {
                            setCcRecipients([...ccRecipients, emp]);
                            setCcSearch('');
                            setShowCcDropdown(false);
                          }}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: 12,
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                        >
                          <div>
                            <strong style={{ color: '#0f172a' }}>{emp.name}</strong>
                            <span style={{ color: '#64748b', marginLeft: 6 }}>&lt;{emp.email}&gt;</span>
                          </div>
                          <span style={{ fontSize: 10, color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>
                            {emp.designation || emp.role}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Subject Field */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  Subject *
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Ticket Escalation Required, AMC Review, Deployment update..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{ fontSize: 13 }}
                  required
                />
              </div>

              {/* Message Body Field */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  Message *
                </label>
                <textarea
                  className="form-control"
                  rows={6}
                  placeholder="Write your internal message here..."
                  value={bodyMessage}
                  onChange={(e) => setBodyMessage(e.target.value)}
                  style={{ fontSize: 13, resize: 'vertical' }}
                  required
                />
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCompose(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSending || toRecipients.length === 0 || !subject.trim() || !bodyMessage.trim()}
                  style={{ minWidth: 140 }}
                >
                  {isSending ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
