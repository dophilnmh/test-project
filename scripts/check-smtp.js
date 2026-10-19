require('dotenv').config();

const nodemailer = require('nodemailer');

/**
 * Get Namecheap Private Email configuration
 */
function getMailConfig() {
  const host = process.env.MAIL_HOST || 'mail.privateemail.com';

  const port = Number(process.env.MAIL_PORT || 465);

  const secure =
    String(process.env.MAIL_SECURE || 'true').toLowerCase() === 'true';

  const user = process.env.MAIL_USER;

  const pass = (process.env.MAIL_PASSWORD || '').replace(/^"|"$/g, '');

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
 * Test SMTP connection and send test email
 */
async function checkSMTP() {
  const { host, port, secure, user, pass, from } = getMailConfig();

  console.log('=== NimblyPolls SMTP Mail Check ===\n');

  /**
   * Check credentials
   */
  if (!user || !pass) {
    console.log('❌ Missing MAIL_USER or MAIL_PASSWORD');

    console.log('\nPlease check your .env file.');

    process.exit(1);
  }

  console.log(`📧 Mail account: ${user}`);

  console.log(`🌐 SMTP host: ${host}`);

  console.log(`🔌 SMTP port: ${port}`);

  console.log(`🔐 Secure: ${secure}`);

  console.log('');

  /**
   * Create transporter
   */
  const transporter = nodemailer.createTransport({
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

  /**
   * Verify SMTP connection
   */
  console.log('🔄 Verifying SMTP connection...');

  try {
    await transporter.verify();

    console.log(`✅ SMTP connection verified successfully for: ${user}`);
  } catch (error) {
    console.log('❌ SMTP verification failed');

    console.log(`Message: ${error?.message || 'Unknown error'}`);

    if (error?.code) {
      console.log(`Code: ${error.code}`);
    }

    if (error?.response) {
      console.log(`Response: ${error.response}`);
    }

    if (error?.responseCode) {
      console.log(`Response Code: ${error.responseCode}`);
    }

    process.exit(1);
  }

  console.log('');

  /**
   * Determine test recipient
   *
   * You can set:
   *
   * BACKUP_EMAIL_TO=your@email.com
   *
   * in .env
   *
   * If not set, the email will be
   * sent to MAIL_USER.
   */
  const recipient =
    process.env.BACKUP_EMAIL_TO || process.env.TEST_EMAIL_TO || user;

  console.log(`📤 Sending test email to: ${recipient}`);

  /**
   * Send test email
   */
  try {
    const info = await transporter.sendMail({
      from,

      to: recipient,

      subject: `NimblyPolls SMTP Test — ${new Date().toISOString()}`,

      text: `
This is a test email from NimblyPolls.

SMTP Configuration:
Host: ${host}
Port: ${port}
Secure: ${secure}
Account: ${user}

If you received this email, your Namecheap Private Email SMTP configuration is working correctly.

Regards,
NimblyPolls
        `.trim(),

      html: `
          <div
            style="
              font-family:Arial,Helvetica,sans-serif;
              max-width:600px;
              margin:0 auto;
              padding:30px;
              line-height:1.6;
              color:#111827;
            "
          >

            <h2>
              NimblyPolls SMTP Test
            </h2>

            <p>
              This is a test email from
              <strong>NimblyPolls</strong>.
            </p>

            <p>
              If you received this email,
              your Namecheap Private Email
              SMTP configuration is working
              correctly.
            </p>

            <hr />

            <p>
              <strong>SMTP Host:</strong>
              ${host}
            </p>

            <p>
              <strong>SMTP Port:</strong>
              ${port}
            </p>

            <p>
              <strong>Secure:</strong>
              ${secure}
            </p>

            <p>
              <strong>Email Account:</strong>
              ${user}
            </p>

            <hr />

            <p>
              Regards,<br />
              <strong>NimblyPolls Team</strong>
            </p>

          </div>
        `,
    });

    console.log('✅ Test email sent successfully!');

    console.log(`📨 Message ID: ${info.messageId}`);

    console.log(`📬 Accepted by: ${info.accepted?.join(', ') || 'None'}`);

    console.log(`📭 Rejected by: ${info.rejected?.join(', ') || 'None'}`);

    console.log('');

    console.log('=== SMTP TEST PASSED ===');
  } catch (error) {
    console.log('❌ Test email sending failed');

    console.log(`Message: ${error?.message || 'Unknown error'}`);

    if (error?.code) {
      console.log(`Code: ${error.code}`);
    }

    if (error?.command) {
      console.log(`Command: ${error.command}`);
    }

    if (error?.response) {
      console.log(`Response: ${error.response}`);
    }

    if (error?.responseCode) {
      console.log(`Response Code: ${error.responseCode}`);
    }

    console.log('');

    console.log('=== SMTP TEST FAILED ===');

    process.exit(1);
  }
}

/**
 * Run test
 */
checkSMTP();
