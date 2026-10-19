import nodemailer from 'nodemailer';

/**
 * Get Namecheap Private Email configuration
 */
function getMailConfig() {
  const host = process.env.MAIL_HOST || 'mail.privateemail.com';

  const port = Number(process.env.MAIL_PORT || 465);

  const secure =
    String(process.env.MAIL_SECURE || 'true').toLowerCase() === 'true';

  const user = process.env.MAIL_USER;

  const pass = process.env.MAIL_PASSWORD?.replace(/^"|"$/g, '');

  const from = process.env.MAIL_FROM || `NimblyPolls <${user}>`;

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
  };
}

/**
 * Create SMTP transporter
 */
function createTransporter() {
  const { host, port, secure, user, pass } = getMailConfig();

  if (!user) {
    throw new Error('MAIL_USER is not configured');
  }

  if (!pass) {
    throw new Error('MAIL_PASSWORD is not configured');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,

    auth: {
      user,
      pass,
    },

    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
}

/**
 * Safely send email
 */
export async function sendMailSafe({
  to,
  subject,
  html,
  text,
  replyTo,
  attachments,
}) {
  const { user, from } = getMailConfig();

  /**
   * Validate required configuration
   */
  if (!user) {
    return {
      ok: false,
      message: 'MAIL_USER is not configured',
    };
  }

  if (!process.env.MAIL_PASSWORD) {
    return {
      ok: false,
      message: 'MAIL_PASSWORD is not configured',
    };
  }

  if (!to) {
    return {
      ok: false,
      message: 'Recipient email is required',
    };
  }

  if (!subject) {
    return {
      ok: false,
      message: 'Email subject is required',
    };
  }

  try {
    /**
     * Create Namecheap SMTP transporter
     */
    const transporter = createTransporter();

    /**
     * Verify SMTP connection
     */
    await transporter.verify();

    console.log('📨 Namecheap SMTP transporter verified for:', user);

    /**
     * Send email
     */
    const info = await transporter.sendMail({
      from,
      to,
      subject,

      html: html || undefined,

      text: text || undefined,

      replyTo: replyTo || undefined,

      attachments: Array.isArray(attachments) ? attachments : undefined,
    });

    console.log('📧 Email sent successfully:', {
      to,
      subject,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    });

    return {
      ok: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    };
  } catch (error) {
    /**
     * Detailed server-side logging
     */
    console.error('❌ Email sending failed:', {
      to,
      subject,

      message: error?.message,

      code: error?.code,

      command: error?.command,

      response: error?.response,

      responseCode: error?.responseCode,
    });

    return {
      ok: false,

      message: error?.message || 'Failed to send email',

      code: error?.code,
    };
  }
}

/**
 * Get default inbox email
 *
 * Used by contact forms and
 * other parts of the application.
 */
export function getDefaultInboxEmail() {
  return (
    process.env.CONTACT_INBOX_EMAIL ||
    process.env.BACKUP_EMAIL_TO ||
    process.env.MAIL_USER ||
    ''
  );
}
