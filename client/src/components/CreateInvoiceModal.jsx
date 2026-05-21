import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, Loader2 } from 'lucide-react';

const initialFormState = {
  application_id: '',
  description: '',
  amount: '',
  due_date: ''
};

const CreateInvoiceModal = ({ isOpen, onClose, onCreated, onSuccess }) => {
  const [clients, setClients] = useState([]);
  const [formData, setFormData] = useState(initialFormState);
  const [loadingClients, setLoadingClients] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const fetchClients = async () => {
      try {
        setLoadingClients(true);
        setError('');
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/clients', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setClients(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Error fetching clients:', err);
        setError('Failed to load clients.');
      } finally {
        setLoadingClients(false);
      }
    };

    fetchClients();
  }, [isOpen]);

  if (!isOpen) return null;

  const invoiceReadyApplications = clients.filter(client => client?.app_status === 'OFFER_APPROVED');
  const selectedApplication = invoiceReadyApplications.find(client => String(client.application_id) === String(formData.application_id));

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleClose = () => {
    setFormData(initialFormState);
    setError('');
    setSuccess('');
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      const token = localStorage.getItem('token');
      const payload = {
        client_id: selectedApplication?.user_id || undefined,
        application_id: formData.application_id,
        description: formData.description,
        amount: formData.amount,
        due_date: formData.due_date
      };

      await axios.post('/api/invoices', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess('Invoice created successfully.');
      onCreated?.();
      onSuccess?.();
      setTimeout(() => {
        handleClose();
      }, 900);
    } catch (err) {
      console.error('Error creating invoice:', err);
      setError(err.response?.data?.message || 'Failed to create invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-gray-200">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Create Invoice</h2>
            <p className="text-sm text-gray-500">Generate a client invoice and send notifications.</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700" htmlFor="application_id">
              Select Application
            </label>
            <select
              id="application_id"
              name="application_id"
              value={formData.application_id}
              onChange={handleChange}
              disabled={loadingClients}
              required
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-800 outline-none focus:border-agency-blue focus:ring-2 focus:ring-blue-100"
            >
              <option value="">{loadingClients ? 'Loading applications...' : 'Choose an admission-issued application'}</option>
              {invoiceReadyApplications.map(client => (
                <option key={client.application_id} value={client.application_id}>
                  {client.app_uid || `APP-${client.application_id}`} - {client.name} {client.email ? `(${client.email})` : ''}
                </option>
              ))}
            </select>
            {!loadingClients && invoiceReadyApplications.length === 0 && (
              <p className="mt-2 text-xs font-semibold text-amber-700">
                Invoices can only be created after the offer letter is approved.
              </p>
            )}
          </div>

          {selectedApplication?.application_id && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Linked to {selectedApplication.app_uid || `APP-${selectedApplication.application_id}`} at {selectedApplication.university_name || 'latest application'}
              {selectedApplication.assigned_counselor_name ? ` with ${selectedApplication.assigned_counselor_name}` : ''}.
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700" htmlFor="description">
              Description / Service Name
            </label>
            <input
              id="description"
              name="description"
              type="text"
              value={formData.description}
              onChange={handleChange}
              placeholder="Visa Fee"
              required
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-800 outline-none focus:border-agency-blue focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700" htmlFor="amount">
                Amount (USD)
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={handleChange}
                required
                className="block w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-800 outline-none focus:border-agency-blue focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700" htmlFor="due_date">
                Due Date
              </label>
              <input
                id="due_date"
                name="due_date"
                type="date"
                value={formData.due_date}
                onChange={handleChange}
                required
                className="block w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-800 outline-none focus:border-agency-blue focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-agency-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-agency-lightBlue disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {submitting ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateInvoiceModal;
