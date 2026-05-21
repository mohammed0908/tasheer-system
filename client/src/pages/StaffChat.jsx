import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Download, Mic, MessageSquare, Paperclip, Plus, Search, Send, User, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { connectUserSocket, socket } from '../utils/socket';

const formatTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const restrictedConversationDepartments = ['Customer Service', 'Admin'];
const reactionOptions = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F64F}', '\u{1F604}', '\u{1F389}'];

const toArray = (value) => Array.isArray(value) ? value : [];
const toObject = (value) => value && typeof value === 'object' ? value : {};
const isEditableWindow = (dateString) => ((Date.now() - new Date(dateString).getTime()) / 1000) <= 120;
const isImageUrl = (url = '') => /\.(png|jpe?g|webp|gif)$/i.test(url.split('?')[0]);

const StaffChat = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [contactFilter, setContactFilter] = useState('all');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState('');
  const [onlineUsers, setOnlineUsers] = useState({});
  const [typingUserId, setTypingUserId] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const typingTimeoutRef = useRef(null);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userDepartment = user.department;
  const userRole = user.role;

  const authHeaders = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`
  }), []);

  useEffect(() => {
    connectUserSocket(user);

    const handlePresence = ({ userId, online }) => {
      setOnlineUsers(prev => ({ ...prev, [userId]: online }));
    };
    const handleTyping = ({ senderId, isTyping }) => {
      setTypingUserId(isTyping ? Number(senderId) : null);
      if (isTyping) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = window.setTimeout(() => setTypingUserId(null), 1800);
      }
    };

    socket.on('presence_update', handlePresence);
    socket.on('typing', handleTyping);
    return () => {
      socket.off('presence_update', handlePresence);
      socket.off('typing', handleTyping);
      window.clearTimeout(typingTimeoutRef.current);
    };
  }, [user]);

  const fetchConversations = useCallback(async () => {
    try {
      const shouldRestrictToCounselors = restrictedConversationDepartments.includes(userDepartment) || userRole === 'admin';
      const res = await axios.get(`/api/messages/conversations${shouldRestrictToCounselors ? '?department=Counselor' : ''}`, {
        headers: authHeaders()
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      setConversations(shouldRestrictToCounselors ? rows.filter(contact => contact.department === 'Counselor') : rows);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
      setError('Unable to load conversations.');
    }
  }, [authHeaders, userDepartment, userRole]);

  const fetchMessages = useCallback(async (clientId) => {
    if (!clientId) return;

    try {
      const res = await axios.get(`/api/messages?userId=${clientId}`, {
        headers: authHeaders()
      });
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch staff messages:', err);
      setError('Unable to load messages for this client.');
    }
  }, [authHeaders]);

  useEffect(() => {
    const initialLoad = window.setTimeout(fetchConversations, 0);
    const interval = window.setInterval(fetchConversations, 8000);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [fetchConversations]);

  useEffect(() => {
    if (!selectedClient?.id) {
      return undefined;
    }

    const initialLoad = window.setTimeout(() => fetchMessages(selectedClient.id), 0);
    const interval = window.setInterval(() => fetchMessages(selectedClient.id), 5000);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [fetchMessages, selectedClient?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filteredConversations = useMemo(() => (
    conversations.filter(conversation =>
      conversation.name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (contactFilter === 'all' ||
        (contactFilter === 'staff' && conversation.contact_type !== 'client' && conversation.role !== 'client') ||
        (contactFilter === 'client' && (conversation.contact_type === 'client' || conversation.role === 'client')))
    )
  ), [conversations, searchTerm, contactFilter]);

  const fetchContacts = useCallback(async () => {
    try {
      const type = contactFilter === 'all' ? 'all' : contactFilter;
      const res = await axios.get(`/api/messages/contacts?type=${type}&search=${encodeURIComponent(contactSearch)}`, {
        headers: authHeaders()
      });
      setContacts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
      setContacts([]);
    }
  }, [authHeaders, contactFilter, contactSearch]);

  useEffect(() => {
    if (!isNewChatOpen) return undefined;
    const timer = window.setTimeout(fetchContacts, 200);
    return () => window.clearTimeout(timer);
  }, [fetchContacts, isNewChatOpen]);

  const handleSelectClient = (client) => {
    setMessages([]);
    setSelectedClient(client);
    setError('');
    setConversations(prev => prev.map(conversation =>
      Number(conversation.id) === Number(client.id)
        ? { ...conversation, unread_count: 0 }
        : conversation
    ));
    axios.put(`/api/messages/read/${client.id}`, {}, {
      headers: authHeaders()
    }).catch(err => {
      console.error('Failed to mark conversation as read:', err);
    });
  };

  const handleSendMessage = async (audioBlob = null) => {
    if (!selectedClient?.id || (!newMessage.trim() && !selectedFile && !audioBlob) || isSending) return;

    const messageText = newMessage.trim();
    const attachment = audioBlob || selectedFile;
    const previewUrl = attachment ? URL.createObjectURL(attachment) : null;
    const optimisticType = audioBlob ? 'audio' : attachment ? 'file' : 'text';
    const optimisticMessage = {
      id: `local-${Date.now()}`,
      sender_id: user.id,
      receiver_id: selectedClient.id,
      sender_name: user.full_name || 'Me',
      receiver_name: selectedClient.name,
      message: messageText,
      image_url: attachment && isImageUrl(attachment.name || '') ? previewUrl : null,
      file_url: previewUrl,
      message_type: optimisticType,
      created_at: new Date().toISOString(),
      is_read: false
    };

    try {
      setIsSending(true);
      setError('');
      setNewMessage('');
      setSelectedFile(null);
      setMessages(prev => [...prev, optimisticMessage]);

      const formData = new FormData();
      formData.append('receiver_id', selectedClient.id);
      formData.append('message', messageText);
      if (audioBlob) {
        formData.append('audio', audioBlob, 'voice-message.webm');
      } else if (selectedFile) {
        formData.append('attachment', selectedFile);
      }

      await axios.post('/api/messages', formData, {
        headers: {
          ...authHeaders(),
          'Content-Type': 'multipart/form-data'
        }
      });

      await Promise.all([
        fetchMessages(selectedClient.id),
        fetchConversations()
      ]);
    } catch (err) {
      console.error('Failed to send staff message:', err);
      setError('Unable to send message.');
      setMessages(prev => prev.filter(message => message.id !== optimisticMessage.id));
      setNewMessage(messageText);
      setSelectedFile(selectedFile);
    } finally {
      setIsSending(false);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleSendMessage(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Microphone access was blocked or unavailable.');
    }
  };

  const handleEditMessage = async (message) => {
    const next = window.prompt('Edit message', message.message || '');
    if (!next?.trim()) return;
    await axios.put(`/api/messages/${message.id}`, { message: next.trim() }, { headers: authHeaders() });
    await fetchMessages(selectedClient.id);
  };

  const handleDeleteMessage = async (message, mode) => {
    await axios.delete(`/api/messages/${message.id}`, {
      headers: authHeaders(),
      data: { mode }
    });
    await fetchMessages(selectedClient.id);
  };

  const handleReact = async (message, emoji) => {
    await axios.post(`/api/messages/${message.id}/react`, { emoji }, { headers: authHeaders() });
    socket.emit('message_reaction', {
      senderId: user.id,
      receiverId: selectedClient?.id,
      messageId: message.id,
      emoji
    });
    await fetchMessages(selectedClient.id);
  };

  const renderAttachment = (message) => {
    const fileUrl = message.file_url || message.image_url;
    if (!fileUrl) return null;
    if (message.message_type === 'audio') return <audio controls src={fileUrl} className="mt-2 max-w-full" />;
    if (isImageUrl(fileUrl)) return <img src={fileUrl} alt="Uploaded attachment" className="mb-2 max-w-xs rounded-lg object-cover" />;
    return (
      <a href={fileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white/80 px-3 py-2 text-xs font-black text-blue-700">
        <Download size={14} /> Download attachment
      </a>
    );
  };

  const handleKeyDown = (event) => {
    if (selectedClient?.id) {
      socket.emit('typing', { senderId: user.id, receiverId: selectedClient.id, isTyping: true });
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = window.setTimeout(() => {
        socket.emit('typing', { senderId: user.id, receiverId: selectedClient.id, isTyping: false });
      }, 900);
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="space-y-6 bg-slate-50" dir="ltr">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Staff Portal / Inbox</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Messages</h2>
      </div>

      <section className="flex h-[80vh] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <aside className="flex w-1/3 min-w-[280px] flex-col border-r border-slate-100">
          <div className="border-b border-slate-100 p-5">
            <h3 className="text-xl font-black text-slate-950">Messages</h3>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {['all', 'staff', 'client'].map(filter => (
                <button key={filter} type="button" onClick={() => setContactFilter(filter)} className={`rounded-xl px-3 py-2 text-xs font-black ${contactFilter === filter ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {filter === 'all' ? 'All' : filter === 'staff' ? 'Staff Only' : 'Clients Only'}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setIsNewChatOpen(true)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white">
              <Plus size={16} /> Start New Chat
            </button>
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Search size={17} className="text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search students..."
                className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {filteredConversations.length === 0 ? (
              <div className="flex h-full items-center justify-center px-5 text-center">
                <div>
                  <MessageSquare size={34} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-black text-slate-600">No conversations found.</p>
                </div>
              </div>
            ) : (
              filteredConversations.map(client => {
                const isSelected = Number(selectedClient?.id) === Number(client.id);
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleSelectClient(client)}
                    className={`mb-2 flex w-full items-center gap-3 rounded-2xl border-l-4 p-3 text-left transition ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                      <User size={19} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-black text-slate-900">{client.name}</p>
                        <span className="shrink-0 text-[11px] font-bold text-slate-400">
                          {formatTime(client.last_message_time)}
                        </span>
                        {Number(client.unread_count) > 0 && (
                          <span className="ml-auto rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold text-white">
                            {client.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                        {client.last_message || (client.last_file_url || client.last_image_url ? `${client.last_message_type || 'File'} attachment` : 'No messages yet')}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <div className="flex w-2/3 flex-1 flex-col">
          {!selectedClient ? (
            <div className="flex h-full items-center justify-center bg-slate-50/60 text-center">
              <div className="rounded-2xl border border-slate-100 bg-white p-10 shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <MessageSquare size={30} />
                </div>
                <p className="mt-5 text-lg font-black text-slate-800">Select a conversation to start chatting</p>
                <p className="mt-2 text-sm font-semibold text-slate-500">Student and staff conversations appear on the left.</p>
              </div>
            </div>
          ) : (
            <>
              <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <User size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-950">{selectedClient.name}</h3>
                    <div className="mt-1 flex items-center gap-2 text-sm font-bold text-emerald-700">
                      <span className={`h-2.5 w-2.5 rounded-full ${onlineUsers[String(selectedClient.id)] ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      {onlineUsers[String(selectedClient.id)] ? 'Online' : 'Offline'}
                    </div>
                  </div>
                </div>
              </header>

              {error && (
                <div className="mx-6 mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                  {error}
                </div>
              )}

              <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-6">
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center">
                    <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
                      <p className="font-black text-slate-700">No messages yet.</p>
                      <p className="mt-1 text-sm font-medium text-slate-500">Send the first update to this contact.</p>
                    </div>
                  </div>
                ) : (
                  messages.map(message => {
                    const isMine = Number(message.sender_id) === Number(user.id);
                    const deletedFor = toArray(message.deleted_for);
                    if (deletedFor.map(Number).includes(Number(user.id))) return null;
                    const isStaffMessage = message.sender_role === 'staff' || message.sender_role === 'admin';
                    const canEditOrDeleteAll = isMine && !String(message.id).startsWith('local-') && isEditableWindow(message.created_at);
                    const reactions = toObject(message.reactions);
                    return (
                      <div key={message.id} className={`group flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[76%] ${isMine ? 'text-right' : 'text-left'}`}>
                          <div
                            onDoubleClick={() => {
                              if (!String(message.id).startsWith('local-') && !message.deleted_for_all) {
                                handleReact(message, '\u{1F44D}').catch(() => toast.error('Could not add reaction.'));
                              }
                            }}
                            className={`p-3 text-sm font-semibold leading-6 shadow-sm ${
                            isMine
                              ? 'rounded-l-2xl rounded-tr-2xl bg-blue-600 text-white'
                              : isStaffMessage
                                ? 'rounded-r-2xl rounded-tl-2xl border border-blue-200 bg-blue-50 text-blue-900 shadow-lg shadow-blue-200/70 ring-1 ring-blue-100'
                              : 'rounded-r-2xl rounded-tl-2xl bg-slate-100 text-slate-800'
                          }`}
                          >
                            {!isMine && isStaffMessage && (
                              <p className="mb-1 text-[11px] font-black uppercase tracking-[0.12em] text-blue-600">
                                Staff
                              </p>
                            )}
                            {message.deleted_for_all ? (
                              <span className="italic opacity-70">This message was deleted.</span>
                            ) : (
                              <>
                                {renderAttachment(message)}
                                {message.message}
                              </>
                            )}
                          </div>
                          {Object.keys(reactions).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {Object.entries(reactions).map(([emoji, users]) => (
                                <span key={emoji} className="rounded-full bg-white px-2 py-0.5 text-xs shadow-sm">{emoji} {toArray(users).length}</span>
                              ))}
                            </div>
                          )}
                          <p className="mt-1 px-1 text-[11px] font-bold text-slate-400">
                            {formatTime(message.created_at)} {message.is_edited ? '(edited)' : ''}
                          </p>
                          {!message.deleted_for_all && !String(message.id).startsWith('local-') && (
                            <div className={`mt-1 flex flex-wrap gap-1 opacity-0 transition group-hover:opacity-100 ${isMine ? 'justify-end' : 'justify-start'}`}>
                              {canEditOrDeleteAll && <button onClick={() => handleEditMessage(message)} className="rounded bg-white px-2 py-1 text-[11px] font-bold text-slate-600 shadow-sm">Edit</button>}
                              {canEditOrDeleteAll && <button onClick={() => handleDeleteMessage(message, 'all')} className="rounded bg-white px-2 py-1 text-[11px] font-bold text-rose-600 shadow-sm">Delete for Everyone</button>}
                              <button onClick={() => handleDeleteMessage(message, 'me')} className="rounded bg-white px-2 py-1 text-[11px] font-bold text-slate-600 shadow-sm">Delete for Me</button>
                              {reactionOptions.map(emoji => <button key={emoji} onClick={() => handleReact(message, emoji)} className="rounded bg-white px-2 py-1 text-xs shadow-sm">{emoji}</button>)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              {typingUserId === Number(selectedClient.id) && (
                <div className="px-6 pb-2 text-sm font-bold text-blue-600">
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1">
                    typing<span className="animate-bounce">.</span><span className="animate-bounce [animation-delay:120ms]">.</span><span className="animate-bounce [animation-delay:240ms]">.</span>
                  </span>
                </div>
              )}

              <footer className="border-t border-slate-100 bg-white p-4">
                {selectedFile && (
                  <div className="mb-3 flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
                    <span className="truncate">{selectedFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="rounded-full p-1 hover:bg-blue-100"
                      aria-label="Remove selected image"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    className="hidden"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSending}
                    className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Attach file"
                  >
                    <Paperclip size={19} />
                  </button>
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={isSending}
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-slate-500 transition disabled:cursor-not-allowed disabled:opacity-50 ${isRecording ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-slate-200 bg-white hover:bg-slate-50 hover:text-blue-600'}`}
                    aria-label="Record audio"
                  >
                    <Mic size={19} />
                  </button>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(event) => setNewMessage(event.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isSending}
                    placeholder="Type your message..."
                    className="h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={(!newMessage.trim() && !selectedFile) || isSending}
                    className="flex h-12 items-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send size={18} />
                    Send
                  </button>
                </div>
              </footer>
            </>
          )}
        </div>
      </section>
      {isNewChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-950">Start New Chat</h3>
              <button onClick={() => setIsNewChatOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <input value={contactSearch} onChange={event => setContactSearch(event.target.value)} placeholder="Search contacts..." className="mb-3 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none" />
            <div className="max-h-80 overflow-y-auto">
              {contacts.map(contact => (
                <button key={contact.id} type="button" onClick={() => { handleSelectClient(contact); setIsNewChatOpen(false); }} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-slate-50">
                  <User size={18} className="text-slate-400" />
                  <div>
                    <p className="font-black text-slate-900">{contact.name}</p>
                    <p className="text-xs font-bold text-slate-400">{contact.role} {contact.department ? `- ${contact.department}` : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffChat;
