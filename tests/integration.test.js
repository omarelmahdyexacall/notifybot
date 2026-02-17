import { describe, it, expect, vi, beforeEach } from "vitest";
import { runCommand } from "../src/runner.js";
import { sendMessage, pollForReply } from "../src/telegram.js";

describe("integration: command -> notify -> reply", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("runs a command, sends notification, handles 'log' reply", async () => {
    // Run a real command
    const result = await runCommand("echo integration-test-output");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("integration-test-output");

    // Mock Telegram send
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes("sendMessage")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, result: { message_id: 10 } }),
        });
      }
      // Mock getUpdates returning "log"
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            result: [
              {
                update_id: 200,
                message: { message_id: 11, chat: { id: 123 }, text: "log" },
              },
            ],
          }),
      });
    });

    // Send notification
    const sent = await sendMessage({
      token: "test",
      chatId: "123",
      text: `Command finished with exit ${result.exitCode}`,
    });
    expect(sent.message_id).toBe(10);

    // Poll for reply
    const reply = await pollForReply({
      token: "test",
      chatId: "123",
      sentMessageId: 10,
      intervalMs: 100,
      timeoutMs: 1000,
    });
    expect(reply).toBe("log");
  });
});
