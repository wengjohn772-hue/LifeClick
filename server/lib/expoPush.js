// Minimal Expo Push client. Expo's push service is free and needs no
// credentials — the device's Expo push token is the address.
//
// https://docs.expo.dev/push-notifications/sending-notifications/

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const MAX_BATCH = 100;

export function isExpoPushToken(token) {
  return typeof token === 'string' && /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
}

/**
 * Sends a batch of messages. Returns a per-message result so the caller can
 * record delivery status and prune tokens the service reports as dead.
 */
export async function sendExpoPush(messages) {
  if (!messages.length) return [];

  const results = [];

  for (let index = 0; index < messages.length; index += MAX_BATCH) {
    const batch = messages.slice(index, index + MAX_BATCH);

    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.data) {
        const detail = payload?.errors?.[0]?.message || `Expo push failed (${response.status})`;
        batch.forEach((message) => results.push({ to: message.to, ok: false, error: detail }));
        continue;
      }

      payload.data.forEach((ticket, position) => {
        const to = batch[position]?.to;
        if (ticket.status === 'ok') {
          results.push({ to, ok: true, id: ticket.id });
        } else {
          results.push({
            to,
            ok: false,
            error: ticket.message || 'Push rejected.',
            // DeviceNotRegistered means the token is dead and should be dropped.
            unregistered: ticket.details?.error === 'DeviceNotRegistered',
          });
        }
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Network failure contacting Expo push.';
      batch.forEach((message) => results.push({ to: message.to, ok: false, error: detail }));
    }
  }

  return results;
}

export function buildMessage({ to, title, body, data, critical }) {
  return {
    to,
    title,
    body,
    sound: 'default',
    priority: 'high',
    channelId: 'safety-alerts',
    // Surfaces the alert even in an Android doze window.
    ...(critical ? { _displayInForeground: true, ttl: 0 } : {}),
    data: data || {},
  };
}
