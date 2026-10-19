const STORE_KEY = '__nimblypolls_mpesa_status_store__';

function getStore() {
  if (!globalThis[STORE_KEY]) {
    globalThis[STORE_KEY] = new Map();
  }
  return globalThis[STORE_KEY];
}

export function setCheckoutStatus(checkoutRequestId, payload) {
  if (!checkoutRequestId) return;
  const store = getStore();
  const current = store.get(checkoutRequestId) || {};

  store.set(checkoutRequestId, {
    ...current,
    ...payload,
    checkoutRequestId,
    updatedAt: new Date().toISOString(),
  });
}

export function getCheckoutStatus(checkoutRequestId) {
  const store = getStore();
  return store.get(checkoutRequestId) || null;
}

export function initCheckoutStatus(checkoutRequestId, payload = {}) {
  setCheckoutStatus(checkoutRequestId, {
    status: 'pending',
    resultDesc: 'Awaiting customer action on phone',
    ...payload,
  });
}
