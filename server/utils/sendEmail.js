import nodemailer from 'nodemailer';

const sendEmail = async (to, subject, text, html) => {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, EMAIL_USER, EMAIL_PASS } = process.env;
  const user = SMTP_USER || EMAIL_USER;
  const pass = SMTP_PASS || EMAIL_PASS;
  const host = SMTP_HOST || 'smtp.gmail.com';
  const port = Number(SMTP_PORT || 587);
  const secure = SMTP_SECURE ? SMTP_SECURE === 'true' : port === 465;

  if (!user || !pass) {
    console.warn(`Email not sent to ${to}: email environment variables are not fully configured.`);
    console.warn(`Subject: ${subject}`);
    console.warn(text);
    return { skipped: true };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000
  });

  return transporter.sendMail({
    from: `"TSMS Security" <${user}>`,
    to,
    subject,
    text,
    html
  });
};

export const sendOfferLetterEmail = (clientEmail, clientName) => sendEmail(
  clientEmail,
  'Your offer letter has been approved',
  `Hello ${clientName || 'there'}, your offer letter has been approved. Please log in to your TSMS portal to review the next steps.`,
  `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h2 style="color: #2563eb;">Offer Letter Approved</h2>
      <p>Hello ${clientName || 'there'},</p>
      <p>Your offer letter has been approved by your counselor. Please log in to your TSMS portal to review the details and continue your application journey.</p>
    </div>
  `
);

export const sendAdmissionDoneEmail = (clientEmail, clientName) => sendEmail(
  clientEmail,
  'Admission issued for your application',
  `Hello ${clientName || 'there'}, your admission has been issued. Please log in to your TSMS portal to download your offer letter and continue the next steps.`,
  `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h2 style="color: #2563eb;">Admission Issued</h2>
      <p>Hello ${clientName || 'there'},</p>
      <p>Your admission has been issued and your approved offer letter is ready in your TSMS portal.</p>
      <p>Please log in to download the offer letter and continue with the payment and visa steps.</p>
    </div>
  `
);

export const sendInvoiceReadyEmail = (clientEmail, clientName) => sendEmail(
  clientEmail,
  'Your invoice is ready for payment',
  `Hello ${clientName || 'there'}, your invoice is now ready. Please log in to your TSMS portal to complete payment.`,
  `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h2 style="color: #2563eb;">Invoice Ready</h2>
      <p>Hello ${clientName || 'there'},</p>
      <p>Your invoice is now ready for payment. Please visit the Payments section in your TSMS portal to proceed.</p>
    </div>
  `
);

export const sendPaymentVerifiedEmail = (clientEmail, clientName) => sendEmail(
  clientEmail,
  'Your payment has been verified',
  `Hello ${clientName || 'there'}, your payment has been verified. Thank you.`,
  `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h2 style="color: #16a34a;">Payment Verified</h2>
      <p>Hello ${clientName || 'there'},</p>
      <p>Your payment has been verified successfully. Thank you. Your application will now continue to the next stage.</p>
    </div>
  `
);

export const sendVisaCompletedEmail = (clientEmail, clientName) => sendEmail(
  clientEmail,
  'Your visa has been completed',
  `Hello ${clientName || 'there'}, your visa has been completed. Please log in to your TSMS portal to review your final documents.`,
  `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h2 style="color: #16a34a;">Visa Completed</h2>
      <p>Hello ${clientName || 'there'},</p>
      <p>Great news: your visa process has been completed successfully.</p>
      <p>Please log in to your TSMS portal to review or download your final documents.</p>
    </div>
  `
);

export const sendCompletionCongratulation = (clientEmail, clientName) => sendEmail(
  clientEmail,
  'Congratulations, your TSMS journey is complete',
  `Hello ${clientName || 'there'}, congratulations! Your application lifecycle has been completed successfully.`,
  `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h2 style="color: #16a34a;">Congratulations!</h2>
      <p>Hello ${clientName || 'there'},</p>
      <p>Your application lifecycle has been completed successfully. Congratulations, and welcome to your next chapter.</p>
    </div>
  `
);

export default sendEmail;
