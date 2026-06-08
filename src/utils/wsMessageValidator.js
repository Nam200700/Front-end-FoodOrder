const VALID_TYPES = new Set([
  'ORDER_UPDATE', 'NEW_MESSAGE', 'NOTIFICATION',
  'SHIPPER_LOCATION', 'ORDER_ACCEPTED', 'ORDER_DELIVERED'
]);

export const validateWsMessage = (body) => {
  try {
    const payload = JSON.parse(body);
    if (!payload || typeof payload !== 'object') return null;
    if (payload.type && !VALID_TYPES.has(payload.type)) return null;
    return payload;
  } catch {
    return null;
  }
};
