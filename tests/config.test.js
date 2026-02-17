import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it("reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from env", () => {
    process.env.TELEGRAM_BOT_TOKEN = "abc123";
    process.env.TELEGRAM_CHAT_ID = "456";
    const config = loadConfig();
    expect(config.token).toBe("abc123");
    expect(config.chatId).toBe("456");
  });

  it("throws if TELEGRAM_BOT_TOKEN is missing", () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_CHAT_ID = "456";
    expect(() => loadConfig()).toThrow("TELEGRAM_BOT_TOKEN");
  });

  it("throws if TELEGRAM_CHAT_ID is missing", () => {
    process.env.TELEGRAM_BOT_TOKEN = "abc123";
    delete process.env.TELEGRAM_CHAT_ID;
    expect(() => loadConfig()).toThrow("TELEGRAM_CHAT_ID");
  });
});
