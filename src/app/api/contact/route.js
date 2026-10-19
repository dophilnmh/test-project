import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import ContactMessage from '@/app/models/ContactMessage';
import { getDefaultInboxEmail, sendMailSafe } from '@/lib/mailer';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const role = session.user.role;
    if (role !== 'admin' && role !== 'superadmin') {
      return NextResponse.json(
        { success: false, message: 'Only admins can access contact inbox' },
        { status: 403 }
      );
    }

    await connect();

    const messages = await ContactMessage.find({})
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, messages });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to load contact messages',
      },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const fullName = String(body?.fullName || '').trim();
    const email = String(body?.email || '').trim();
    const phone = String(body?.phone || '').trim();
    const subject = String(body?.subject || '').trim();
    const message = String(body?.message || '').trim();

    if (!fullName || !email || !subject || !message) {
      return NextResponse.json(
        {
          success: false,
          message: 'Name, email, subject, and message are required',
        },
        { status: 400 }
      );
    }

    await connect();

    const saved = await ContactMessage.create({
      fullName,
      email,
      phone,
      subject,
      message,
      source: 'website-contact',
      status: 'new',
    });

    const inboxEmail = getDefaultInboxEmail();
    const notifications = [];

    if (inboxEmail) {
      notifications.push(
        sendMailSafe({
          to: inboxEmail,
          replyTo: email,
          subject: `[Contact] ${subject}`,
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
              <h2>New Contact Message</h2>
              <p><strong>Name:</strong> ${fullName}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Phone:</strong> ${phone || '-'}</p>
              <p><strong>Subject:</strong> ${subject}</p>
              <p><strong>Message:</strong></p>
              <p>${message.replace(/\n/g, '<br/>')}</p>
              <p><strong>Reference:</strong> ${String(saved._id)}</p>
            </div>
          `,
          text: `New contact message\nName: ${fullName}\nEmail: ${email}\nPhone: ${phone || '-'}\nSubject: ${subject}\nMessage: ${message}\nReference: ${String(saved._id)}`,
        })
      );
    }

    notifications.push(
      sendMailSafe({
        to: email,
        subject: 'We received your message - NimblyPolls',
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
            <h2>Hello ${fullName},</h2>
            <p>Thank you for contacting NimblyPolls. Your message has been received.</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Reference:</strong> ${String(saved._id)}</p>
            <p>Our team will respond as soon as possible.</p>
          </div>
        `,
        text: `Hello ${fullName},\n\nWe received your message with subject: ${subject}.\nReference: ${String(saved._id)}\n\nOur team will respond soon.`,
      })
    );

    const notificationResults = await Promise.allSettled(notifications);
    const delivered = notificationResults.filter(
      (item) => item.status === 'fulfilled' && item.value?.ok
    ).length;

    return NextResponse.json({
      success: true,
      message: 'Message sent successfully. Our team will contact you shortly.',
      contactId: saved._id,
      emailNotificationsSent: delivered,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to submit contact message',
      },
      { status: 500 }
    );
  }
}
