const BASE_URL = "https://api.telegram.org/bot";

export async function sendMessage({ token, chatId, text }) {
  const url = `${BASE_URL}${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Telegram API error ${res.status}: ${data.description}`);
  }
  return data.result;
}

export async function pollForReply({
  token,
  chatId,
  sentMessageId,
  intervalMs = 2000,
  timeoutMs = 120000,
}) {
  const url = `${BASE_URL}${token}/getUpdates`;
  let offset = 0;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(`${url}?offset=${offset}&timeout=1`);
    const data = await res.json();

    if (data.ok && data.result.length > 0) {
      for (const update of data.result) {
        offset = update.update_id + 1;
        const msg = update.message;
        if (
          msg &&
          String(msg.chat.id) === String(chatId) &&
          msg.message_id > sentMessageId
        ) {
          return msg.text.trim().toLowerCase();
        }
      }
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return null;
}
