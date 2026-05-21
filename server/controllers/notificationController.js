import db from '../config/db.js';
import { ensureNotificationsTable } from './taskController.js';

export const getUnreadNotifications = async (req, res) => {
  try {
    await ensureNotificationsTable();

    const [notifications] = await db.query(
      `SELECT id, message, type, application_id, app_uid, target_url, is_read, created_at
       FROM notifications
       WHERE user_id = ? AND is_read = FALSE
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(notifications);
  } catch (error) {
    console.error('Error in getUnreadNotifications:', error);
    res.status(500).json({ message: 'Server error while fetching notifications' });
  }
};

export const getAdminNotifications = async (req, res) => {
  try {
    await ensureNotificationsTable();

    const [notifications] = await db.query(
      `SELECT id, message, type, application_id, app_uid, target_url, is_read, created_at
       FROM notifications
       WHERE user_id = ? AND is_read = FALSE
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(notifications);
  } catch (error) {
    console.error('Error in getAdminNotifications:', error);
    res.status(500).json({ message: 'Server error while fetching admin notifications' });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    await ensureNotificationsTable();

    const [result] = await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error in markNotificationRead:', error);
    res.status(500).json({ message: 'Server error while updating notification' });
  }
};
