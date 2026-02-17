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
