import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendMessage } from "../src/telegram.js";

describe("sendMessage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls Telegram API with correct URL and body", async () => {
    const mockResponse = { ok: true, result: { message_id: 1 } };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await sendMessage({
      token: "fake-token",
      chatId: "123",
      text: "Hello",
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.telegram.org/botfake-token/sendMessage",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: "123", text: "Hello" }),
      }
    );
    expect(result.message_id).toBe(1);
  });

  it("throws on API error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ ok: false, description: "Unauthorized" }),
    });

    await expect(
      sendMessage({ token: "bad", chatId: "123", text: "Hi" })
    ).rejects.toThrow("Telegram API error 401: Unauthorized");
  });
});
