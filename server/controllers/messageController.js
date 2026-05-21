import db from '../config/db.js';

export const ensureMessagesTable = async (connection = db) => {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sender_id INT NOT NULL,
      receiver_id INT NOT NULL,
      message TEXT NOT NULL,
      image_url TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_read BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  try {
    await connection.query('ALTER TABLE messages ADD COLUMN image_url TEXT DEFAULT NULL');
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') {
      throw error;
    }
  }

  const columns = [
    "ALTER TABLE messages ADD COLUMN message_type VARCHAR(20) DEFAULT 'text'",
    'ALTER TABLE messages ADD COLUMN file_url VARCHAR(255) DEFAULT NULL',
    'ALTER TABLE messages ADD COLUMN is_edited BOOLEAN DEFAULT FALSE',
    'ALTER TABLE messages ADD COLUMN deleted_for_all BOOLEAN DEFAULT FALSE',
    "ALTER TABLE messages ADD COLUMN deleted_for JSON DEFAULT ('[]')",
    "ALTER TABLE messages ADD COLUMN reactions JSON DEFAULT ('{}')"
  ];

  for (const statement of columns) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }
};

const safeParseJson = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getUploadedFile = (req) => (
  req.file ||
  req.files?.attachment?.[0] ||
  req.files?.audio?.[0] ||
  req.files?.image?.[0] ||
  null
);

const canMutateForAll = (createdAt) => {
  const ageSeconds = (Date.now() - new Date(createdAt).getTime()) / 1000;
  return ageSeconds <= 120;
};

const toPublicUploadPath = (filePath) => {
  if (!filePath) return null;
  const normalizedPath = filePath.replace(/\\/g, '/');
  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
};

export const getMessages = async (req, res) => {
  try {
    await ensureMessagesTable();

    const { userId } = req.query;
    const queryParams = [req.user.id, req.user.id];
    let conversationFilter = '';

    if (userId) {
      conversationFilter = 'AND (m.sender_id = ? OR m.receiver_id = ?)';
      queryParams.push(userId, userId);
    }

    const [messages] = await db.query(
      `SELECT
        m.id,
        m.sender_id,
        m.receiver_id,
        m.message,
        m.image_url,
        m.message_type,
        m.file_url,
        m.created_at,
        m.is_read,
        m.is_edited,
        m.deleted_for_all,
        m.deleted_for,
        m.reactions,
        sender.full_name AS sender_name,
        sender.role AS sender_role,
        sender.department AS sender_department,
        sender.job_title AS sender_job_title,
        receiver.full_name AS receiver_name
        ,receiver.role AS receiver_role
       FROM messages m
       JOIN users sender ON m.sender_id = sender.id
       JOIN users receiver ON m.receiver_id = receiver.id
       WHERE (m.sender_id = ? OR m.receiver_id = ?)
       ${conversationFilter}
       ORDER BY m.created_at ASC`,
      queryParams
    );

    res.json(messages.map(message => ({
      ...message,
      deleted_for_all: Boolean(message.deleted_for_all),
      is_edited: Boolean(message.is_edited),
      deleted_for: safeParseJson(message.deleted_for, []),
      reactions: safeParseJson(message.reactions, {})
    })));
  } catch (error) {
    console.error('Error in getMessages:', error);
    res.status(500).json({ message: 'Server error while fetching messages' });
  }
};

export const getConversations = async (req, res) => {
  try {
    await ensureMessagesTable();

    const [actorRows] = await db.query('SELECT role, department, job_title FROM users WHERE id = ?', [req.user.id]);
    const actor = actorRows[0] || req.user;
    const shouldShowCounselors = actor.role === 'admin' || ['Customer Service', 'Admin'].includes(actor.department);

    if (shouldShowCounselors) {
      const [counselors] = await db.query(
        `SELECT
          u.id,
          u.full_name AS name,
          u.email,
          u.department,
          u.job_title,
          latest.message AS last_message,
          latest.image_url AS last_image_url,
          latest.message_type AS last_message_type,
          latest.file_url AS last_file_url,
          latest.created_at AS last_message_time,
          COALESCE(unread.unread_count, 0) AS unread_count
         FROM users u
         LEFT JOIN (
           SELECT
             CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS contact_id,
             message,
             image_url,
             message_type,
             file_url,
             created_at,
             ROW_NUMBER() OVER (
               PARTITION BY CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END
               ORDER BY created_at DESC
             ) AS rn
           FROM messages
           WHERE sender_id = ? OR receiver_id = ?
         ) latest ON latest.contact_id = u.id AND latest.rn = 1
         LEFT JOIN (
           SELECT sender_id AS contact_id, COUNT(*) AS unread_count
           FROM messages
           WHERE receiver_id = ? AND is_read = FALSE
           GROUP BY sender_id
         ) unread ON unread.contact_id = u.id
         WHERE u.role = 'staff'
           AND u.department = 'Counselor'
           AND latest.created_at IS NOT NULL
         ORDER BY latest.created_at DESC, u.full_name ASC`,
        [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]
      );

      return res.json(counselors);
    }

    const messageParams = [];
    const staffParams = [];
    let staffFilter = '';
    let messageStaffFilter = '';

    if (req.user.role === 'staff') {
      messageStaffFilter = 'AND (m.sender_id = ? OR m.receiver_id = ?)';
      messageParams.push(req.user.id, req.user.id);
      staffFilter = 'AND a.assigned_staff_id = ?';
      staffParams.push(req.user.id);
    }

    const [clientConversations] = await db.query(
      `SELECT
        u.id,
        u.full_name AS name,
        u.email,
        'client' AS contact_type,
        s.phone,
        latest.message AS last_message,
        latest.image_url AS last_image_url,
        latest.message_type AS last_message_type,
        latest.file_url AS last_file_url,
        latest.created_at AS last_message_time,
        COALESCE(unread.unread_count, 0) AS unread_count
       FROM applications a
       JOIN users u ON a.student_id = u.id
       LEFT JOIN students s ON u.id = s.user_id
       LEFT JOIN (
         SELECT
           paired.client_id,
           paired.message,
           paired.image_url,
           paired.message_type,
           paired.file_url,
           paired.created_at
         FROM (
           SELECT
             CASE
               WHEN sender.role = 'client' THEN m.sender_id
               ELSE m.receiver_id
             END AS client_id,
             m.message,
             m.image_url,
             m.message_type,
             m.file_url,
             m.created_at,
             ROW_NUMBER() OVER (
               PARTITION BY CASE
                 WHEN sender.role = 'client' THEN m.sender_id
                 ELSE m.receiver_id
               END
               ORDER BY m.created_at DESC
             ) AS rn
           FROM messages m
           JOIN users sender ON m.sender_id = sender.id
           JOIN users receiver ON m.receiver_id = receiver.id
           WHERE (sender.role = 'client' OR receiver.role = 'client')
           ${messageStaffFilter}
         ) paired
         WHERE paired.rn = 1
       ) latest ON latest.client_id = u.id
       LEFT JOIN (
         SELECT sender_id AS client_id, COUNT(*) AS unread_count
         FROM messages
         WHERE receiver_id = ?
           AND is_read = FALSE
         GROUP BY sender_id
       ) unread ON unread.client_id = u.id
       WHERE u.role = 'client'
         ${staffFilter}
         AND latest.created_at IS NOT NULL
       GROUP BY u.id, u.full_name, u.email, s.phone, latest.message, latest.image_url, latest.created_at, unread.unread_count
       ORDER BY latest.created_at DESC, u.full_name ASC`,
      [...messageParams, req.user.id, ...staffParams]
    );

    if (req.user.role !== 'staff') {
      return res.json(clientConversations);
    }

    const [staffConversations] = await db.query(
      `SELECT
        contact.id,
        contact.full_name AS name,
        contact.email,
        contact.role,
        contact.department,
        contact.job_title,
        'staff' AS contact_type,
        latest.message AS last_message,
        latest.image_url AS last_image_url,
        latest.message_type AS last_message_type,
        latest.file_url AS last_file_url,
        latest.created_at AS last_message_time,
        COALESCE(unread.unread_count, 0) AS unread_count
       FROM users contact
       JOIN (
         SELECT
           paired.contact_id,
           paired.message,
           paired.image_url,
           paired.message_type,
           paired.file_url,
           paired.created_at
         FROM (
           SELECT
             CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS contact_id,
             message,
             image_url,
             message_type,
             file_url,
             created_at,
             ROW_NUMBER() OVER (
               PARTITION BY CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END
               ORDER BY created_at DESC
             ) AS rn
           FROM messages
           WHERE sender_id = ? OR receiver_id = ?
         ) paired
         WHERE paired.rn = 1
       ) latest ON latest.contact_id = contact.id
       LEFT JOIN (
         SELECT sender_id AS contact_id, COUNT(*) AS unread_count
         FROM messages
         WHERE receiver_id = ?
           AND is_read = FALSE
         GROUP BY sender_id
       ) unread ON unread.contact_id = contact.id
       WHERE contact.id <> ?
         AND contact.role <> 'client'
       ORDER BY latest.created_at DESC, contact.full_name ASC`,
      [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]
    );

    const conversations = [...staffConversations, ...clientConversations]
      .sort((a, b) => new Date(b.last_message_time || 0) - new Date(a.last_message_time || 0));

    res.json(conversations);
  } catch (error) {
    console.error('Error in getConversations:', error);
    res.status(500).json({ message: 'Server error while fetching conversations' });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    await ensureMessagesTable();

    const [rows] = await db.query(
      'SELECT COUNT(*) AS count FROM messages WHERE receiver_id = ? AND is_read = FALSE',
      [req.user.id]
    );

    res.json({ count: Number(rows[0]?.count || 0) });
  } catch (error) {
    console.error('Error in getUnreadCount:', error);
    res.status(500).json({ message: 'Server error while fetching unread count' });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const { senderId } = req.params;

    await ensureMessagesTable();

    const [result] = await db.query(
      'UPDATE messages SET is_read = TRUE WHERE sender_id = ? AND receiver_id = ?',
      [senderId, req.user.id]
    );

    res.json({ message: 'Messages marked as read', updated: result.affectedRows });
  } catch (error) {
    console.error('Error in markMessagesAsRead:', error);
    res.status(500).json({ message: 'Server error while marking messages as read' });
  }
};

export const createMessage = async (req, res) => {
  try {
    const { receiver_id, message = '' } = req.body;
    const file = getUploadedFile(req);
    const fileUrl = toPublicUploadPath(file?.path);
    const imageUrl = file?.mimetype?.startsWith('image/') ? fileUrl : null;
    const messageType = file?.mimetype?.startsWith('audio/')
      ? 'audio'
      : fileUrl
        ? 'file'
        : 'text';
    const messageText = message.trim();

    if (!receiver_id || (!messageText && !fileUrl)) {
      return res.status(400).json({ message: 'Receiver and message or attachment are required' });
    }

    await ensureMessagesTable();

    const [receivers] = await db.query('SELECT id FROM users WHERE id = ?', [receiver_id]);
    if (receivers.length === 0) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    const [result] = await db.query(
      'INSERT INTO messages (sender_id, receiver_id, message, image_url, message_type, file_url) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, receiver_id, messageText, imageUrl, messageType, fileUrl]
    );

    const [messages] = await db.query(
      `SELECT
        m.id,
        m.sender_id,
        m.receiver_id,
        m.message,
        m.image_url,
        m.message_type,
        m.file_url,
        m.created_at,
        m.is_read,
        m.is_edited,
        m.deleted_for_all,
        m.deleted_for,
        m.reactions,
        sender.full_name AS sender_name,
        sender.role AS sender_role,
        sender.department AS sender_department,
        sender.job_title AS sender_job_title,
        receiver.full_name AS receiver_name
        ,receiver.role AS receiver_role
       FROM messages m
       JOIN users sender ON m.sender_id = sender.id
       JOIN users receiver ON m.receiver_id = receiver.id
       WHERE m.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      ...messages[0],
      deleted_for_all: Boolean(messages[0].deleted_for_all),
      is_edited: Boolean(messages[0].is_edited),
      deleted_for: safeParseJson(messages[0].deleted_for, []),
      reactions: safeParseJson(messages[0].reactions, {})
    });
  } catch (error) {
    console.error('Error in createMessage:', error);
    res.status(500).json({ message: 'Server error while sending message' });
  }
};

export const getContacts = async (req, res) => {
  try {
    const { type = 'all', search = '' } = req.query;
    const params = [req.user.id];
    let typeSql = '';

    if (type === 'staff') typeSql = "AND role IN ('staff', 'admin')";
    if (type === 'client') typeSql = "AND role = 'client'";

    let searchSql = '';
    if (search.trim()) {
      searchSql = 'AND (full_name LIKE ? OR email LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    const [contacts] = await db.query(
      `SELECT id, full_name AS name, email, role, department, job_title
       FROM users
       WHERE id <> ?
       ${typeSql}
       ${searchSql}
       ORDER BY full_name ASC
       LIMIT 50`,
      params
    );

    res.json(contacts);
  } catch (error) {
    console.error('Error in getContacts:', error);
    res.status(500).json({ message: 'Server error while fetching contacts' });
  }
};

export const editMessage = async (req, res) => {
  try {
    await ensureMessagesTable();
    const nextMessage = String(req.body.message || '').trim();
    if (!nextMessage) return res.status(400).json({ message: 'Message text is required' });

    const [messages] = await db.query('SELECT id, sender_id, created_at FROM messages WHERE id = ?', [req.params.id]);
    const message = messages[0];
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (Number(message.sender_id) !== Number(req.user.id)) return res.status(403).json({ message: 'You can only edit your own messages' });
    if (!canMutateForAll(message.created_at)) return res.status(403).json({ message: 'Messages can only be edited within 2 minutes' });

    await db.query('UPDATE messages SET message = ?, is_edited = TRUE WHERE id = ?', [nextMessage, req.params.id]);
    res.json({ message: 'Message updated' });
  } catch (error) {
    console.error('Error in editMessage:', error);
    res.status(500).json({ message: 'Server error while editing message' });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    await ensureMessagesTable();
    const mode = req.body.mode || 'me';
    const [messages] = await db.query('SELECT id, sender_id, created_at, deleted_for FROM messages WHERE id = ?', [req.params.id]);
    const message = messages[0];
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (mode === 'all') {
      if (Number(message.sender_id) !== Number(req.user.id)) return res.status(403).json({ message: 'You can only delete your own messages for everyone' });
      if (!canMutateForAll(message.created_at)) return res.status(403).json({ message: 'Messages can only be deleted for everyone within 2 minutes' });
      await db.query("UPDATE messages SET deleted_for_all = TRUE, message = '', image_url = NULL, file_url = NULL, message_type = 'text' WHERE id = ?", [req.params.id]);
      return res.json({ message: 'Message deleted for everyone' });
    }

    const deletedFor = safeParseJson(message.deleted_for, []);
    const userId = Number(req.user.id);
    if (!deletedFor.includes(userId)) deletedFor.push(userId);
    await db.query('UPDATE messages SET deleted_for = ? WHERE id = ?', [JSON.stringify(deletedFor), req.params.id]);
    res.json({ message: 'Message deleted for you' });
  } catch (error) {
    console.error('Error in deleteMessage:', error);
    res.status(500).json({ message: 'Server error while deleting message' });
  }
};

export const reactToMessage = async (req, res) => {
  try {
    await ensureMessagesTable();
    const emoji = String(req.body.emoji || '').trim();
    if (!emoji) return res.status(400).json({ message: 'Emoji is required' });

    const [messages] = await db.query('SELECT id, reactions FROM messages WHERE id = ?', [req.params.id]);
    const message = messages[0];
    if (!message) return res.status(404).json({ message: 'Message not found' });

    const reactions = safeParseJson(message.reactions, {});
    const users = Array.isArray(reactions[emoji]) ? reactions[emoji] : [];
    const userId = Number(req.user.id);
    reactions[emoji] = users.includes(userId) ? users.filter(id => id !== userId) : [...users, userId];
    if (reactions[emoji].length === 0) delete reactions[emoji];

    await db.query('UPDATE messages SET reactions = ? WHERE id = ?', [JSON.stringify(reactions), req.params.id]);
    res.json({ message: 'Reaction updated', reactions });
  } catch (error) {
    console.error('Error in reactToMessage:', error);
    res.status(500).json({ message: 'Server error while reacting to message' });
  }
};
