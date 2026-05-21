import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Download, Mic, Paperclip, Send, User, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { connectUserSocket, socket } from '../utils/socket';

const formatTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const reactionOptions = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F64F}', '\u{1F604}', '\u{1F389}'];
const toArray = (value) => Array.isArray(value) ? value : [];
const toObject = (value) => value && typeof value === 'object' ? value : {};
const isEditableWindow = (dateString) => ((Date.now() - new Date(dateString).getTime()) / 1000) <= 120;
const isImageUrl = (url = '') => /\.(png|jpe?g|webp|gif)$/i.test(url.split('?')[0]);

const ClientChat = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [assignedStaff, setAssignedStaff] = useState(null);
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchAssignedStaff = useCallback(async () => {
    try {
      const res = await axios.get('/api/clients/me', {
        headers: authHeaders()
      });
      if (res.data?.assigned_staff_id) {
        setAssignedStaff({
          id: res.data.assigned_staff_id,
          name: res.data.assigned_counselor_name || 'Your Counselor'
        });
        axios.put(`/api/messages/read/${res.data.assigned_staff_id}`, {}, {
          headers: authHeaders()
        }).catch(err => {
          console.error('Failed to mark client messages as read:', err);
        });
      } else {
        setAssignedStaff(null);
      }
    } catch (err) {
      console.error('Failed to fetch assigned staff:', err);
      setError('Unable to load your assigned counselor.');
    }
  }, [authHeaders]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await axios.get('/api/messages', {
        headers: authHeaders()
      });
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      setError('Unable to load messages.');
    }
  }, [authHeaders]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      fetchAssignedStaff();
      fetchMessages();
    }, 0);

    const interval = window.setInterval(fetchMessages, 5000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [fetchAssignedStaff, fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (audioBlob = null) => {
    if ((!newMessage.trim() && !selectedFile && !audioBlob) || !assignedStaff?.id || isSending) return;

    const messageText = newMessage.trim();
    const attachment = audioBlob || selectedFile;
    const previewUrl = attachment ? URL.createObjectURL(attachment) : null;
    const optimisticMessage = {
      id: `local-${Date.now()}`,
      sender_id: user.id,
      receiver_id: assignedStaff.id,
      sender_name: user.full_name || 'Me',
      receiver_name: assignedStaff.name,
      message: messageText,
      image_url: attachment && isImageUrl(attachment.name || '') ? previewUrl : null,
      file_url: previewUrl,
      message_type: audioBlob ? 'audio' : attachment ? 'file' : 'text',
      created_at: new Date().toISOString(),
      is_read: false,
      deleted_for: [],
      reactions: {}
    };

    try {
      setIsSending(true);
      setError('');
      setNewMessage('');
      setSelectedFile(null);
      setMessages(prev => [...prev, optimisticMessage]);

      const formData = new FormData();
      formData.append('receiver_id', assignedStaff.id);
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
      await fetchMessages();
    } catch (err) {
      console.error('Failed to send message:', err);
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
    await fetchMessages();
  };

  const handleDeleteMessage = async (message, mode) => {
    await axios.delete(`/api/messages/${message.id}`, {
      headers: authHeaders(),
      data: { mode }
    });
    await fetchMessages();
  };

  const handleReact = async (message, emoji) => {
    await axios.post(`/api/messages/${message.id}/react`, { emoji }, { headers: authHeaders() });
    socket.emit('message_reaction', {
      senderId: user.id,
      receiverId: assignedStaff?.id,
      messageId: message.id,
      emoji
    });
    await fetchMessages();
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
    if (assignedStaff?.id) {
      socket.emit('typing', { senderId: user.id, receiverId: assignedStaff.id, isTyping: true });
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = window.setTimeout(() => {
        socket.emit('typing', { senderId: user.id, receiverId: assignedStaff.id, isTyping: false });
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
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Client Portal / Messages</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Chat with Staff</h2>
      </div>

      <section className="flex h-[75vh] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <User size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-950">
                Chat with {assignedStaff?.name || 'Assigned Counselor'}
              </h3>
              <div className="mt-1 flex items-center gap-2 text-sm font-bold text-emerald-700">
                <span className={`h-2.5 w-2.5 rounded-full ${onlineUsers[String(assignedStaff?.id)] ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                {onlineUsers[String(assignedStaff?.id)] ? 'Online' : 'Offline'}
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div className="mx-5 mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {error}
          </div>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-6">
          {!assignedStaff?.id ? (
            <div className="flex h-full items-center justify-center text-center">
              <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
                <p className="font-black text-slate-700">No counselor assigned yet.</p>
                <p className="mt-1 text-sm font-medium text-slate-500">Your chat will be available once staff assigns your application.</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
                <p className="font-black text-slate-700">No messages yet.</p>
                <p className="mt-1 text-sm font-medium text-slate-500">Send your first message to start the conversation.</p>
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
                      <div className={`mt-1 flex flex-wrap gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
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
                        {canEditOrDeleteAll && <button type="button" onClick={() => handleEditMessage(message)} className="rounded bg-white px-2 py-1 text-[11px] font-bold text-slate-600 shadow-sm">Edit</button>}
                        {canEditOrDeleteAll && <button type="button" onClick={() => handleDeleteMessage(message, 'all')} className="rounded bg-white px-2 py-1 text-[11px] font-bold text-rose-600 shadow-sm">Delete for Everyone</button>}
                        <button type="button" onClick={() => handleDeleteMessage(message, 'me')} className="rounded bg-white px-2 py-1 text-[11px] font-bold text-slate-600 shadow-sm">Delete for Me</button>
                        {reactionOptions.map(emoji => <button key={emoji} type="button" onClick={() => handleReact(message, emoji)} className="rounded bg-white px-2 py-1 text-xs shadow-sm">{emoji}</button>)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        {typingUserId === Number(assignedStaff?.id) && (
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
                aria-label="Remove selected file"
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
              disabled={!assignedStaff?.id || isSending}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Attach file"
            >
              <Paperclip size={19} />
            </button>
            <button
              type="button"
              onClick={toggleRecording}
              disabled={!assignedStaff?.id || isSending}
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
              disabled={!assignedStaff?.id || isSending}
              placeholder={assignedStaff?.id ? 'Type your message...' : 'No counselor assigned yet'}
              className="h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={(!newMessage.trim() && !selectedFile) || !assignedStaff?.id || isSending}
              className="flex h-12 items-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={18} />
              Send
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default ClientChat;
