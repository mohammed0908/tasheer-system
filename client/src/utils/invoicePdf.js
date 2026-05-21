import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const logoLeftBase64 = '';
const logoRightBase64 = '';
const stampBase64 = '';

const agencyBlue = [10, 30, 80];
const mutedText = [95, 111, 130];
const borderGrey = [220, 226, 235];

const money = (amount) => `$${Number(amount || 0).toFixed(2)}`;

const formatDate = (dateString) => {
  if (!dateString) return 'Not recorded';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

const getValue = (...values) => {
  const value = values.find(item => item !== undefined && item !== null && item !== '');
  return value === undefined ? 'Not provided' : String(value);
};

const addImageIfAvailable = (doc, base64, format, x, y, width, height) => {
  if (!base64) return;

  try {
    doc.addImage(base64, format, x, y, width, height);
  } catch (error) {
    console.warn('Invoice PDF image could not be added:', error);
  }
};

const normalizeInvoice = (invoiceData = {}) => {
  const client = invoiceData.client || {};
  const application = invoiceData.application || {};
  const invoiceNumber = getValue(
    invoiceData.invoice_number,
    invoiceData.invoiceNumber,
    invoiceData.payment_id && `INV-${invoiceData.payment_id}`,
    invoiceData.id && `INV-${invoiceData.id}`,
    'INV-DRAFT'
  );
  const total = Number(invoiceData.total ?? invoiceData.amount ?? 0);
  const subtotal = Number(invoiceData.subtotal ?? total);
  const items = Array.isArray(invoiceData.items) && invoiceData.items.length > 0
    ? invoiceData.items
    : [{
      description: invoiceData.description || 'Application Service Fee',
      amount: total
    }];

  return {
    invoiceNumber,
    createdAt: invoiceData.created_at || invoiceData.createdAt || invoiceData.payment_date,
    dueDate: invoiceData.due_date || invoiceData.dueDate,
    subtotal,
    total,
    status: getValue(invoiceData.payment_status, invoiceData.rawStatus, invoiceData.status, 'Pending'),
    client: {
      fullName: getValue(client.full_name, client.name, invoiceData.client_name),
      passportNumber: getValue(client.passport_number, client.passport_no, invoiceData.passport_number, invoiceData.passport_no),
      email: getValue(client.email, invoiceData.client_email, invoiceData.email),
      phone: getValue(client.phone, invoiceData.phone)
    },
    application: {
      appUid: getValue(application.app_uid, invoiceData.app_uid, invoiceData.application_id && `APP-${invoiceData.application_id}`),
      university: getValue(application.university, application.university_name, invoiceData.university, invoiceData.university_name),
      program: getValue(application.program, application.program_name, invoiceData.program, invoiceData.program_name)
    },
    items
  };
};

export const generateInvoicePDF = (invoiceData = {}) => {
  const invoice = normalizeInvoice(invoiceData);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const gap = 12;
  const columnWidth = (pageWidth - (margin * 2) - gap) / 2;
  const rightColumnX = margin + columnWidth + gap;

  doc.setLanguage('en-US');
  doc.setProperties({
    title: `Tasheer Invoice ${invoice.invoiceNumber}`,
    subject: 'Invoice',
    author: 'Tasheer Agency'
  });

  addImageIfAvailable(doc, logoLeftBase64, 'PNG', margin, 10, 32, 24);
  addImageIfAvailable(doc, logoRightBase64, 'PNG', pageWidth - margin - 28, 8, 28, 28);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...agencyBlue);
  doc.text('TASHEER AGENCY', margin, 43);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  doc.text('Student Management Services', margin, 48);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...agencyBlue);
  doc.text('INVOICE', pageWidth / 2, 61, { align: 'center' });

  doc.setDrawColor(...agencyBlue);
  doc.setLineWidth(0.6);
  doc.line(margin, 68, pageWidth - margin, 68);

  doc.setFontSize(12);
  doc.setTextColor(...agencyBlue);
  doc.text('Invoice Details', margin, 82);
  doc.text('Billed To', rightColumnX, 82);

  doc.setDrawColor(...borderGrey);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, 88, columnWidth, 50, 2, 2);
  doc.roundedRect(rightColumnX, 88, columnWidth, 82, 2, 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(25, 35, 50);

  const detailLine = (label, value, x, y, labelWidth = 30, maxWidth = 48) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, x, y);
    doc.setFont('helvetica', 'normal');
    const text = doc.splitTextToSize(String(value), maxWidth);
    doc.text(text, x + labelWidth, y);
  };

  detailLine('Invoice Number', invoice.invoiceNumber, margin + 4, 99, 34, columnWidth - 42);
  detailLine('Date', formatDate(invoice.createdAt), margin + 4, 110, 34, columnWidth - 42);
  detailLine('Due Date', formatDate(invoice.dueDate), margin + 4, 121, 34, columnWidth - 42);
  detailLine('Payment Status', invoice.status, margin + 4, 132, 34, columnWidth - 42);

  detailLine('Student Name', invoice.client.fullName, rightColumnX + 4, 99, 34, columnWidth - 42);
  detailLine('App ID', invoice.application.appUid, rightColumnX + 4, 110, 34, columnWidth - 42);
  detailLine('Passport', invoice.client.passportNumber, rightColumnX + 4, 121, 34, columnWidth - 42);
  detailLine('Email', invoice.client.email, rightColumnX + 4, 132, 34, columnWidth - 42);
  detailLine('Phone', invoice.client.phone, rightColumnX + 4, 143, 34, columnWidth - 42);
  detailLine('University', invoice.application.university, rightColumnX + 4, 154, 34, columnWidth - 42);
  detailLine('Program', invoice.application.program, rightColumnX + 4, 165, 34, columnWidth - 42);

  const tableRows = invoice.items.map((item, index) => [
    String(index + 1),
    item.description || item.name || 'Invoice Item',
    money(item.amount ?? item.total ?? item.price)
  ]);

  const tableOptions = {
    startY: 184,
    head: [['#', 'Description', 'Amount (USD)']],
    body: tableRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 3.5,
      textColor: [25, 35, 50],
      lineColor: borderGrey,
      lineWidth: 0.2
    },
    headStyles: {
      fillColor: agencyBlue,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left'
    },
    alternateRowStyles: {
      fillColor: [247, 249, 252]
    },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      2: { cellWidth: 38, halign: 'right' }
    },
    margin: { left: margin, right: margin }
  };

  if (typeof doc.autoTable === 'function') {
    doc.autoTable(tableOptions);
  } else {
    autoTable(doc, tableOptions);
  }

  const tableEndY = doc.lastAutoTable?.finalY || 205;
  const summaryX = pageWidth - margin - 72;
  let summaryY = tableEndY + 16;

  doc.setFontSize(10);
  doc.setTextColor(25, 35, 50);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', summaryX, summaryY);
  doc.text(money(invoice.subtotal), pageWidth - margin, summaryY, { align: 'right' });

  summaryY += 9;
  doc.text('Tax (0%):', summaryX, summaryY);
  doc.text('$0.00', pageWidth - margin, summaryY, { align: 'right' });

  summaryY += 5;
  doc.setDrawColor(...agencyBlue);
  doc.line(summaryX, summaryY, pageWidth - margin, summaryY);

  summaryY += 9;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...agencyBlue);
  doc.text('Total Amount:', summaryX, summaryY);
  doc.text(money(invoice.total), pageWidth - margin, summaryY, { align: 'right' });

  addImageIfAvailable(doc, stampBase64, 'PNG', pageWidth - margin - 42, pageHeight - 66, 42, 42);

  doc.setDrawColor(...borderGrey);
  doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  doc.text('Tasheer Agency - Official invoice generated in English (LTR).', margin, pageHeight - 10);
  doc.text(`Invoice ${invoice.invoiceNumber}`, pageWidth - margin, pageHeight - 10, { align: 'right' });

  doc.save(`Tasheer_Invoice_${invoice.invoiceNumber}.pdf`);
};
