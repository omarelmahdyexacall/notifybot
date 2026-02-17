import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadConfig() {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const val = match[2].trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch {
    // .env not found, rely on existing env vars
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token) throw new Error("Missing env var: TELEGRAM_BOT_TOKEN");
  if (!chatId) throw new Error("Missing env var: TELEGRAM_CHAT_ID");

  return { token, chatId };
}
