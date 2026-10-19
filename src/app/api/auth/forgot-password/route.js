import { NextResponse } from 'next/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

import connect from '@/app/utils/db';
import User from '@/app/models/User';
import Organizer from '@/app/models/Organizer';

export const runtime = 'nodejs';

const OTP_EXPIRY_MINUTES = 10;

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
 * Create Namecheap SMTP transporter
 */
function createMailTransporter() {
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

    // Helps with some SMTP/network environments
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
}

/**
 * Send password reset OTP email
 */
async function sendOtpEmail({ to, otp }) {
  const { user, from } = getMailConfig();

  const transporter = createMailTransporter();

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

    subject: 'Your NimblyPolls password reset OTP',

    text: `
Password Reset OTP

Your NimblyPolls password reset OTP is:

${otp}

This OTP expires in ${OTP_EXPIRY_MINUTES} minutes.

If you did not request a password reset, you can safely ignore this email.

Regards,
NimblyPolls Team
      `.trim(),

    html: `
        <!DOCTYPE html>

        <html>
          <head>
            <meta charset="UTF-8" />

            <meta
              name="viewport"
              content="width=device-width, initial-scale=1.0"
            />

            <title>
              Password Reset OTP
            </title>
          </head>

          <body
            style="
              margin:0;
              padding:0;
              background:#f3f4f6;
              font-family:Arial,Helvetica,sans-serif;
            "
          >

            <div
              style="
                max-width:600px;
                margin:40px auto;
                background:#ffffff;
                border-radius:12px;
                overflow:hidden;
                box-shadow:0 2px 10px rgba(0,0,0,0.08);
              "
            >

              <!-- Header -->
              <div
                style="
                  padding:25px;
                  text-align:center;
                  background:#111827;
                  color:#ffffff;
                "
              >

                <h1
                  style="
                    margin:0;
                    font-size:28px;
                  "
                >
                  NimblyPolls
                </h1>

              </div>

              <!-- Content -->
              <div
                style="
                  padding:35px 30px;
                  color:#111827;
                  line-height:1.6;
                "
              >

                <h2
                  style="
                    margin-top:0;
                    font-size:22px;
                  "
                >
                  Password Reset OTP
                </h2>

                <p>
                  We received a request to reset
                  your NimblyPolls account password.
                </p>

                <p>
                  Use the OTP below to continue:
                </p>

                <!-- OTP -->
                <div
                  style="
                    text-align:center;
                    margin:30px 0;
                  "
                >

                  <span
                    style="
                      display:inline-block;
                      padding:15px 25px;
                      background:#111827;
                      color:#ffffff;
                      border-radius:8px;
                      font-size:28px;
                      letter-spacing:6px;
                      font-weight:bold;
                    "
                  >
                    ${otp}
                  </span>

                </div>

                <p>
                  This OTP will expire in
                  <strong>
                    ${OTP_EXPIRY_MINUTES} minutes
                  </strong>.
                </p>

                <p>
                  For your security, do not share
                  this OTP with anyone.
                </p>

                <p>
                  If you did not request a password
                  reset, you can safely ignore this
                  email.
                </p>

                <p
                  style="
                    margin-top:30px;
                  "
                >
                  Regards,<br />

                  <strong>
                    NimblyPolls Team
                  </strong>
                </p>

              </div>

              <!-- Footer -->
              <div
                style="
                  padding:20px;
                  text-align:center;
                  background:#f9fafb;
                  color:#6b7280;
                  font-size:12px;
                "
              >

                © ${new Date().getFullYear()}
                NimblyPolls.
                All rights reserved.

              </div>

            </div>

          </body>
        </html>
      `,
  });

  console.log('📧 Password reset OTP email sent:', {
    to,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  });

  return info;
}

/**
 * Generate secure 6-digit OTP
 */
function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash OTP before storing in database
 */
function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

/**
 * POST
 *
 * Request:
 * {
 *   "email": "user@example.com"
 * }
 */
export async function POST(request) {
  try {
    /**
     * Read request body
     */
    const body = await request.json();

    const normalizedEmail = String(body?.email || '')
      .trim()
      .toLowerCase();

    /**
     * Validate email
     */
    if (!normalizedEmail) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Email is required',
        },
        {
          status: 400,
        }
      );
    }

    /**
     * Connect to MongoDB
     */
    await connect();

    /**
     * Find account
     *
     * First check User,
     * then Organizer.
     */
    const account =
      (await User.findOne({
        email: normalizedEmail,
      })) ||
      (await Organizer.findOne({
        email: normalizedEmail,
      }));

    /**
     * Do not reveal whether an
     * email address exists.
     */
    if (!account) {
      return NextResponse.json({
        ok: true,

        message: 'If an account exists, an OTP has been sent to the email.',
      });
    }

    /**
     * Generate OTP
     */
    const otp = generateOtp();

    /**
     * Hash OTP before storing it
     */
    const otpHash = hashOtp(otp);

    /**
     * Calculate expiry
     */
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    /**
     * Save hashed OTP
     */
    account.resetPasswordToken = otpHash;

    account.resetPasswordExpires = expiresAt;

    await account.save();

    console.log('🔐 Password reset OTP generated:', {
      email: normalizedEmail,

      expiresAt: expiresAt.toISOString(),

      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });

    /**
     * Send OTP email
     */
    let deliveryFailed = false;

    try {
      await sendOtpEmail({
        to: normalizedEmail,
        otp,
      });

      console.log('✅ OTP delivery successful for:', normalizedEmail);
    } catch (mailError) {
      deliveryFailed = true;

      console.error('❌ OTP email delivery failed:', {
        email: normalizedEmail,

        error: mailError?.message,

        code: mailError?.code,

        command: mailError?.command,

        response: mailError?.response,

        responseCode: mailError?.responseCode,

        stack: mailError?.stack,
      });
    }

    /**
     * Development response
     *
     * NEVER expose OTP in production.
     */
    return NextResponse.json({
      ok: true,

      message: deliveryFailed
        ? 'OTP generated, but email delivery failed. Please try again later.'
        : 'If an account exists, an OTP has been sent to the email.',

      expiresInMinutes: OTP_EXPIRY_MINUTES,

      deliveryFailed,

      ...(process.env.NODE_ENV !== 'production'
        ? {
            devOtp: otp,
          }
        : {}),
    });
  } catch (error) {
    /**
     * Log complete server error
     */
    console.error('❌ Forgot password error:', {
      message: error?.message,

      code: error?.code,

      stack: error?.stack,
    });

    /**
     * Keep generic response
     * for security.
     */
    return NextResponse.json(
      {
        ok: false,

        message: 'Unable to send OTP right now. Please try again later.',
      },
      {
        status: 500,
      }
    );
  }
}
