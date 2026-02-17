import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendMessage, pollForReply } from "../src/telegram.js";

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

describe("pollForReply", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  it("returns the reply text when a new message arrives after sentMessageId", async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, result: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            result: [
              {
                update_id: 100,
                message: { message_id: 5, chat: { id: 123 }, text: "retry" },
              },
            ],
          }),
      });
    });

    const promise = pollForReply({
      token: "fake-token",
      chatId: "123",
      sentMessageId: 3,
      intervalMs: 1000,
      timeoutMs: 10000,
    });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    const reply = await promise;
    expect(reply).toBe("retry");
  });

  it("returns null on timeout", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: [] }),
    });

    const promise = pollForReply({
      token: "fake-token",
      chatId: "123",
      sentMessageId: 3,
      intervalMs: 1000,
      timeoutMs: 3000,
    });

    await vi.advanceTimersByTimeAsync(4000);

    const reply = await promise;
    expect(reply).toBeNull();
  });
});
