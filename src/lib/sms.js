import axios from 'axios';

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) {
    return `254${digits.slice(1)}`;
  }
  return String(phone || '').trim();
}

export async function sendSmsSafe({ phone, message }) {
  if (!phone || !message) {
    return { ok: false, message: 'Missing phone or message' };
  }

  if (
    !process.env.API_KEY ||
    !process.env.PARTNER_ID ||
    !process.env.SENDERID
  ) {
    return { ok: false, message: 'SMS credentials are not configured' };
  }

  try {
    const payload = {
      apikey: process.env.API_KEY,
      partnerID: process.env.PARTNER_ID,
      shortcode: process.env.SENDERID,
      mobile: normalizePhone(phone),
      message,
    };

    const response = await axios.post(
      'https://sms.textsms.co.ke/api/services/sendsms/',
      payload
    );

    const code = response.data?.responses?.[0]?.['response-code'];

    return {
      ok: code === 200,
      code,
      response: response.data,
    };
  } catch (error) {
    return {
      ok: false,
      message: error?.response?.data || error?.message || 'SMS failed',
    };
  }
}
