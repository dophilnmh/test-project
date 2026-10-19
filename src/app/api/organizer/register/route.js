import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import nodemailer from 'nodemailer';

import connect from '@/app/utils/db';
import Organizer from '@/app/models/Organizer';
import User from '@/app/models/User';

import { sendMailSafe } from '@/lib/mailer';
import { sendSmsSafe } from '@/lib/sms';

export const runtime = 'nodejs';

/**
 * Normalize Kenyan phone numbers
 */
function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');

  if (digits.startsWith('254') && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith('0') && digits.length === 10) {
    return `254${digits.slice(1)}`;
  }

  return String(phone || '').trim();
}

/**
 * Send organizer registration SMS
 */
async function sendOrganizerRegistrationSms({
  phone,
  contactName,
  organizationName,
}) {
  if (
    !process.env.API_KEY ||
    !process.env.PARTNER_ID ||
    !process.env.SENDERID
  ) {
    throw new Error('SMS credentials are not configured');
  }

  const firstName =
    String(contactName || '')
      .trim()
      .split(' ')[0] || 'there';

  const smsMessage = `Hello ${firstName}, your organizer account for ${organizationName} has been created successfully on NimblyPolls.`;

  const smsPayload = {
    apikey: process.env.API_KEY,
    partnerID: process.env.PARTNER_ID,
    message: smsMessage,
    shortcode: process.env.SENDERID,
    mobile: normalizePhone(phone),
  };

  await axios.post(
    'https://sms.textsms.co.ke/api/services/sendsms/',
    smsPayload
  );
}

/**
 * Create Namecheap Private Email transporter
 */
function createMailTransporter() {
  const host = process.env.MAIL_HOST || 'mail.privateemail.com';
  const port = Number(process.env.MAIL_PORT || 465);

  const secure =
    String(process.env.MAIL_SECURE || 'true').toLowerCase() === 'true';

  const user = process.env.MAIL_USER;
  const password = process.env.MAIL_PASSWORD;

  if (!user) {
    throw new Error('MAIL_USER is not configured');
  }

  if (!password) {
    throw new Error('MAIL_PASSWORD is not configured');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass: password,
    },
  });
}

/**
 * Send organizer registration email
 */
async function sendOrganizerRegistrationEmail({
  to,
  contactName,
  organizationName,
}) {
  const transporter = createMailTransporter();

  const mailUser = process.env.MAIL_USER;

  const mailFrom = process.env.MAIL_FROM || `NimblyPolls <${mailUser}>`;

  // Verify SMTP connection before sending
  await transporter.verify();

  await transporter.sendMail({
    from: mailFrom,
    to,
    subject: 'Organizer account created successfully',

    text: `
Hello ${String(contactName || '').trim()},

Your organizer account for ${String(
      organizationName || ''
    ).trim()} has been created successfully on NimblyPolls.

You can now log in and start creating events for admin approval.

Regards,
NimblyPolls
    `.trim(),

    html: `
      <div
        style="
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: 0 auto;
          padding: 30px;
          line-height: 1.6;
          color: #111827;
          background-color: #ffffff;
        "
      >

        <div
          style="
            text-align: center;
            margin-bottom: 25px;
          "
        >
          <h1
            style="
              margin: 0;
              color: #111827;
              font-size: 28px;
            "
          >
            NimblyPolls
          </h1>
        </div>

        <div
          style="
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 25px;
          "
        >

          <h2
            style="
              margin-top: 0;
              color: #111827;
            "
          >
            Organizer Account Created
          </h2>

          <p>
            Hello ${String(contactName || '').trim()},
          </p>

          <p>
            Your organizer account for
            <strong>
              ${String(organizationName || '').trim()}
            </strong>
            has been created successfully on
            <strong>NimblyPolls</strong>.
          </p>

          <p>
            Your account is currently
            <strong>pending admin approval</strong>.
          </p>

          <p>
            Once your account has been approved, you will be able to
            log in and start creating events.
          </p>

          <p>
            Thank you for choosing NimblyPolls.
          </p>

          <p>
            Regards,<br />
            <strong>NimblyPolls Team</strong>
          </p>

        </div>

        <div
          style="
            text-align: center;
            margin-top: 25px;
            font-size: 12px;
            color: #6b7280;
          "
        >
          © ${new Date().getFullYear()} NimblyPolls. All rights reserved.
        </div>

      </div>
    `,
  });
}

/**
 * POST - Organizer Registration
 */
export async function POST(req) {
  try {
    const body = await req.json();

    const {
      organizationName,
      contactName,
      email,
      phone,
      county,
      subCounty,
      website,
      description,
      password,
    } = body || {};

    /**
     * Validate required fields
     */
    if (
      !organizationName ||
      !contactName ||
      !email ||
      !phone ||
      !county ||
      !subCounty ||
      !password
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required organizer fields',
        },
        { status: 400 }
      );
    }

    /**
     * Normalize email
     */
    const normalizedEmail = String(email).trim().toLowerCase();

    /**
     * Connect to database
     */
    await connect();

    /**
     * Check if organizer already exists
     */
    const existing = await Organizer.findOne({
      email: normalizedEmail,
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: 'Organizer account already exists for this email',
        },
        { status: 409 }
      );
    }

    /**
     * Hash password
     */
    const hash = await bcrypt.hash(password, 10);

    /**
     * Create organizer
     */
    const organizer = await Organizer.create({
      organizationName: String(organizationName).trim(),

      contactName: String(contactName).trim(),

      email: normalizedEmail,

      phone: String(phone).trim(),

      county: String(county).trim(),

      subCounty: String(subCounty).trim(),

      website: String(website || '').trim(),

      description: String(description || '').trim(),

      password: hash,

      role: 'organizer',

      status: 'pending',
    });

    /**
     * Get superadmins
     */
    const superadmins = await User.find({
      role: 'superadmin',
    })
      .select(
        'email notificationPhone phone notificationEmailEnabled notificationSmsEnabled'
      )
      .lean();

    /**
     * Notification tasks
     */
    const notificationTasks = [
      /**
       * Send confirmation SMS to organizer
       */
      sendOrganizerRegistrationSms({
        phone: organizer.phone,
        contactName: organizer.contactName,
        organizationName: organizer.organizationName,
      }),

      /**
       * Send confirmation email to organizer
       * Uses Namecheap Private Email SMTP
       */
      sendOrganizerRegistrationEmail({
        to: organizer.email,
        contactName: organizer.contactName,
        organizationName: organizer.organizationName,
      }),

      /**
       * Notify all superadmins
       */
      ...superadmins.flatMap((admin) => {
        const tasks = [];

        /**
         * Superadmin email notification
         */
        if (admin.email && admin.notificationEmailEnabled !== false) {
          tasks.push(
            sendMailSafe({
              to: admin.email,

              subject: 'Organizer registration pending approval',

              html: `
                <div
                  style="
                    font-family: Arial, sans-serif;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 25px;
                    line-height: 1.6;
                    color: #111827;
                  "
                >

                  <h2>
                    New Organizer Registration
                  </h2>

                  <p>
                    A new organizer has registered on
                    <strong>NimblyPolls</strong>.
                  </p>

                  <hr />

                  <p>
                    <strong>Organization:</strong><br />
                    ${organizer.organizationName}
                  </p>

                  <p>
                    <strong>Contact Person:</strong><br />
                    ${organizer.contactName}
                  </p>

                  <p>
                    <strong>Email:</strong><br />
                    ${organizer.email}
                  </p>

                  <p>
                    <strong>Phone:</strong><br />
                    ${organizer.phone}
                  </p>

                  <p>
                    <strong>County:</strong><br />
                    ${organizer.county}
                  </p>

                  <p>
                    <strong>Sub-County:</strong><br />
                    ${organizer.subCounty}
                  </p>

                  ${
                    organizer.website
                      ? `
                        <p>
                          <strong>Website:</strong><br />
                          ${organizer.website}
                        </p>
                      `
                      : ''
                  }

                  <p>
                    <strong>Status:</strong>
                    Pending approval
                  </p>

                  <hr />

                  <p>
                    Please log in to the NimblyPolls
                    administration panel to review this
                    organizer registration.
                  </p>

                </div>
              `,

              text: `
New organizer registration pending approval.

Organization:
${organizer.organizationName}

Contact:
${organizer.contactName}

Email:
${organizer.email}

Phone:
${organizer.phone}

County:
${organizer.county}

Sub-County:
${organizer.subCounty}

Status:
Pending approval.

Please review the registration in the NimblyPolls admin panel.
              `.trim(),
            })
          );
        }

        /**
         * Superadmin SMS notification
         */
        const smsPhone = admin.notificationPhone || admin.phone;

        if (smsPhone && admin.notificationSmsEnabled) {
          tasks.push(
            sendSmsSafe({
              phone: smsPhone,

              message: `Pending organizer registration: ${organizer.organizationName} (${organizer.contactName}). Review in admin panel.`,
            })
          );
        }

        return tasks;
      }),
    ];

    /**
     * Execute all notifications
     * without allowing one failure to stop the others
     */
    const notificationResults = await Promise.allSettled(notificationTasks);

    /**
     * Find failed notifications
     */
    const notificationFailures = notificationResults.filter(
      (result) => result.status === 'rejected'
    );

    /**
     * Log notification errors
     */
    if (notificationFailures.length) {
      console.error(
        'Organizer registration notifications failed:',
        notificationFailures.map(
          (result) => result.reason?.message || 'Unknown error'
        )
      );
    }

    /**
     * Return successful registration response
     */
    return NextResponse.json({
      success: true,

      message:
        notificationFailures.length > 0
          ? 'Organizer account submitted for approval, but one or more notifications could not be delivered.'
          : 'Organizer account submitted for approval. You will be notified once it is approved.',

      notificationsDelivered: notificationFailures.length === 0,

      status: 'pending',
    });
  } catch (error) {
    console.error('Organizer registration error:', error);

    return NextResponse.json(
      {
        success: false,

        message: error?.message || 'Unable to register organizer',
      },
      { status: 500 }
    );
  }
}
