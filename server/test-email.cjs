require('dotenv').config();

const nodemailer = require('nodemailer');

const {
  EMAIL_USER,
  EMAIL_PASS,
  SMTP_HOST = 'smtp.gmail.com',
  SMTP_PORT = '465',
  SMTP_SECURE = 'true',
  TEST_EMAIL_TO
} = process.env;

console.log('Email environment check:', {
  EMAIL_USER_defined: Boolean(EMAIL_USER),
  EMAIL_PASS_defined: Boolean(EMAIL_PASS),
  EMAIL_PASS_length: EMAIL_PASS ? EMAIL_PASS.length : 0,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE
});

if (!EMAIL_USER || !EMAIL_PASS) {
  console.error('Missing EMAIL_USER or EMAIL_PASS in server/.env');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: SMTP_SECURE === 'true',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  },
  tls: {
    // Useful on some local development networks with inspected certificates.
    // Remove this in production.
    rejectUnauthorized: false
  },
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 20000,
  logger: true,
  debug: true
});

const run = async () => {
  try {
    console.log('Verifying SMTP connection...');
    await transporter.verify();
    console.log('SMTP verify OK. Sending test email...');

    const info = await transporter.sendMail({
      from: `"TSMS Test" <${EMAIL_USER}>`,
      to: TEST_EMAIL_TO || EMAIL_USER,
      subject: 'TSMS Nodemailer Test',
      text: 'If you received this email, TSMS Nodemailer configuration is working.',
      html: '<p>If you received this email, <strong>TSMS Nodemailer configuration is working</strong>.</p>'
    });

    console.log('Email sent successfully.');
    console.log('Nodemailer response:', info);
  } catch (error) {
    console.error('Nodemailer failed with full error object:');
    console.error(error);
    console.error('Useful fields:', {
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      response: error.response,
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

run();
