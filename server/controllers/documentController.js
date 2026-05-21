import db from '../config/db.js';
import { ensureDocumentUploaderColumn } from './clientController.js';

export const uploadDocument = async (req, res) => {
  try {
    const { application_id, document_type } = req.body;

    if (!application_id) {
      return res.status(400).json({ message: 'application_id is required' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Document file is required' });
    }

    const [applications] = await db.query('SELECT id FROM applications WHERE id = ?', [application_id]);
    if (applications.length === 0) {
      return res.status(404).json({ message: 'Application not found' });
    }

    await ensureDocumentUploaderColumn();

    const [result] = await db.query(
      'INSERT INTO documents (application_id, document_type, file_path, uploaded_by_role) VALUES (?, ?, ?, ?)',
      [application_id, document_type || 'staffUpload', req.file.path, req.user.role]
    );

    res.status(201).json({
      message: 'Document uploaded successfully',
      documentId: result.insertId
    });
  } catch (error) {
    console.error('Error in uploadDocument:', error);
    res.status(500).json({ message: 'Server error while uploading document' });
  }
};
