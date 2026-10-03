import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';
import { useNotifications } from '../../context/NotificationContext';
import { Search, Send, MessageSquare } from 'lucide-react';
import { formatDateTime } from '../../utils/date';
import { useAuth } from '../../context/AuthContext';

function getConversationName(conv: any, myUserId: number) {
  if (conv.isGroup && conv.title) return conv.title;
  if (conv.participants) {
    const other = conv.participants.find((p: any) => p.userId !== myUserId || p.user?.id !== myUserId);
    if (other) {
      const otherUser = other.user;
      return otherUser?.employee?.name || otherUser?.email || 'Direct Message';
    }
  }
  return conv.title || 'Conversation';
}

export const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchEmp, setSearchEmp] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEmpDropdown, setShowEmpDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.role === 'CUSTOMER') return;
    loadConversations();
  }, []);

  useEffect(() => {
    if (searchEmp.length >= 2) {
      searchEmployees();
      setShowEmpDropdown(true);
    } else {
      setEmployees([]);
      setShowEmpDropdown(false);
    }
  }, [searchEmp]);

  useEffect(() => {
    let interval: any;
    if (selectedChat) {
      loadMessages(selectedChat.id);
      interval = setInterval(() => {
        loadMessages(selectedChat.id, true);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const convs = await api.getConversations();
      setConversations(convs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const searchEmployees = async () => {
    try {
      const res = await api.getEmployees({ search: searchEmp, limit: 8 });
      setEmployees(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadMessages = async (chatId: number, silent = false) => {
    try {
      const msgs = await api.getMessages(chatId);
      setMessages(msgs);
      await api.markMessagesRead(chatId);
      if (!silent) {
        setConversations(prev => prev.map(c => c.id === chatId ? { ...c, unreadCount: 0 } : c));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartChat = async (targetUserId: number) => {
    try {
      const chat = await api.startDirectChat(targetUserId);
      setShowEmpDropdown(false);
      setSearchEmp('');
      setEmployees([]);
      // Re-load convs and select the new one
      const convs = await api.getConversations();
      setConversations(convs);
      const found = convs.find((c: any) => c.id === chat?.id) || chat;
      if (found) setSelectedChat(found);
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;
    try {
      await api.sendMessage(selectedChat.id, newMessage);
      setNewMessage('');
      loadMessages(selectedChat.id);
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  const getSenderName = (m: any) => {
    return m.sender?.employee?.name || m.sender?.email || 'Unknown';
  };

  if (user?.role === 'CUSTOMER') {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
        <MessageSquare size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
        <h3>Access Restricted</h3>
        <p>Internal Chat is only available to Kanvtech employees.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto', height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Internal Chat</h1>
        <p style={{ color: '#64748b', marginTop: 4 }}>Secure employee-to-employee messaging. Not routed via external email.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0', position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search employees..."
                style={{ paddingLeft: 30, fontSize: 13 }}
                value={searchEmp}
                onChange={(e) => setSearchEmp(e.target.value)}
                onFocus={() => employees.length > 0 && setShowEmpDropdown(true)}
                onBlur={() => setTimeout(() => setShowEmpDropdown(false), 200)}
              />
            </div>
            {showEmpDropdown && employees.length > 0 && (
              <div style={{ position: 'absolute', left: 16, right: 16, top: '100%', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 6, zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                {employees.map(emp => (
                  <div key={emp.user_id}
                    style={{ padding: '8px 10px', cursor: 'pointer', borderRadius: 4, fontSize: 13 }}
                    onMouseDown={() => handleStartChat(emp.user_id)}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ fontWeight: 600 }}>{emp.name}</div>
                    <div style={{ color: '#64748b', fontSize: 11 }}>{emp.level} • {emp.department}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>Loading...</div>
            ) : conversations.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                No conversations yet.<br />Search for an employee to start chatting.
              </div>
            ) : (
              conversations.map(c => (
                <div
                  key={c.id}
                  style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: selectedChat?.id === c.id ? '#eff6ff' : 'transparent', transition: 'background 0.1s' }}
                  onClick={() => setSelectedChat(c)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
                      {getConversationName(c, user?.id || 0)}
                    </div>
                    {c.unreadCount > 0 && (
                      <div style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center' }}>
                        {c.unreadCount}
                      </div>
                    )}
                  </div>
                  {c.messages?.[0] && (
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.messages[0].message}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
          {selectedChat ? (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                  {getConversationName(selectedChat, user?.id || 0)}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Internal Staff Channel</div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 13 }}>
                    No messages yet. Say hello!
                  </div>
                ) : (
                  messages.map(m => {
                    const isMe = m.senderId === user?.id;
                    return (
                      <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          background: isMe ? '#0ea5e9' : '#f1f5f9',
                          color: isMe ? '#fff' : '#0f172a',
                          padding: '8px 14px',
                          borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          maxWidth: '70%',
                          fontSize: 14,
                          lineHeight: 1.5,
                        }}>
                          {m.message}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                          {!isMe && <span style={{ fontWeight: 600, marginRight: 6 }}>{getSenderName(m)}</span>}
                          {formatDateTime(m.createdAt)}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              <div style={{ padding: 16, borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
                <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="btn btn-primary" disabled={!newMessage.trim()}>
                    <Send size={16} /> Send
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              <MessageSquare size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
              <h3 style={{ color: '#475569', margin: 0 }}>Select a conversation</h3>
              <p style={{ marginTop: 8, fontSize: 14 }}>Or search for an employee above to start a new chat.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
