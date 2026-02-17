# Notifybot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI tool that wraps any shell command, notifies you on Telegram when it finishes, and reacts to your Telegram replies (retry, log, kill).

**Architecture:** A Node.js CLI that spawns a child process, captures stdout/stderr, and on completion sends a summary via Telegram Bot HTTP API. It then polls for replies using `getUpdates` with an offset, parses the reply text, and takes action (re-run, send logs, or kill). No external dependencies beyond Node.js built-ins — uses native `fetch` (Node 20+) and `child_process`.

**Tech Stack:** Node.js 20, Telegram Bot HTTP API (raw fetch, no libraries), Vitest for testing

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `.devcontainer/devcontainer.json`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `README.md`

**Step 1: Create package.json**

```json
{
  "name": "notifybot",
  "version": "1.0.0",
  "description": "CLI that wraps commands and notifies you on Telegram when they finish",
  "type": "module",
  "bin": {
    "notifybot": "./bin/notifybot.js"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Create devcontainer.json**

```json
{
  "name": "Notifybot",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:20",
  "postCreateCommand": "npm install",
  "customizations": {
    "vscode": {
      "settings": {
        "editor.formatOnSave": true
      }
    }
  }
}
```

**Step 3: Create .env.example**

```
TELEGRAM_BOT_TOKEN=your-bot-token-here
TELEGRAM_CHAT_ID=your-chat-id-here
```

**Step 4: Create .gitignore**

```
node_modules/
.env
```

**Step 5: Create README.md**

```markdown
# notifybot

Wrap any CLI command — get notified on Telegram when it finishes. Reply to take action.

## Setup

1. Create a Telegram bot via @BotFather and copy the token
2. Send any message to your bot, then visit `https://api.telegram.org/bot<TOKEN>/getUpdates` to find your chat_id
3. Copy `.env.example` to `.env` and fill in your values
4. `npm install && npm link`

## Usage

notifybot <command>
# Example:
notifybot npm run build

When the command finishes, you get a Telegram message. Reply with:
- **retry** — re-run the command
- **log** — get the full output
- **kill** — kill the process (if still running)
```

**Step 6: Install dependencies and commit**

```bash
npm install
git add package.json package-lock.json .devcontainer/ .env.example .gitignore README.md
git commit -m "chore: scaffold project with devcontainer config"
```

---

### Task 2: Telegram Module — sendMessage

**Files:**
- Create: `src/telegram.js`
- Create: `tests/telegram.test.js`

**Step 1: Write the failing test for sendMessage**

```js
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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/telegram.test.js`
Expected: FAIL — `sendMessage` not found

**Step 3: Write minimal implementation**

```js
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
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/telegram.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/telegram.js tests/telegram.test.js
git commit -m "feat: add sendMessage Telegram API wrapper with tests"
```

---

### Task 3: Telegram Module — pollForReply

**Files:**
- Modify: `src/telegram.js`
- Modify: `tests/telegram.test.js`

**Step 1: Write the failing test for pollForReply**

Add to `tests/telegram.test.js`:

```js
import { sendMessage, pollForReply } from "../src/telegram.js";

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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/telegram.test.js`
Expected: FAIL — `pollForReply` not found

**Step 3: Write minimal implementation**

Add to `src/telegram.js`:

```js
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
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/telegram.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/telegram.js tests/telegram.test.js
git commit -m "feat: add pollForReply with timeout and offset tracking"
```

---

### Task 4: Command Runner Module

**Files:**
- Create: `src/runner.js`
- Create: `tests/runner.test.js`

**Step 1: Write the failing tests**

```js
import { describe, it, expect } from "vitest";
import { runCommand } from "../src/runner.js";

describe("runCommand", () => {
  it("captures stdout and exit code 0 for a successful command", async () => {
    const result = await runCommand("echo hello");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello");
    expect(result.stderr).toBe("");
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it("captures stderr and non-zero exit code for a failing command", async () => {
    const result = await runCommand("node -e \"process.stderr.write('err'); process.exit(1)\"");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("err");
  });

  it("returns the kill function that terminates the process", async () => {
    let killFn;
    const promise = runCommand("node -e \"setTimeout(() => {}, 30000)\"", {
      onStart: (kill) => { killFn = kill; },
    });
    setTimeout(() => killFn(), 100);
    const result = await promise;
    expect(result.exitCode).not.toBe(0);
    expect(result.killed).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/runner.test.js`
Expected: FAIL — `runCommand` not found

**Step 3: Write minimal implementation**

```js
import { spawn } from "node:child_process";

export function runCommand(command, { onStart } = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    let stdout = "";
    let stderr = "";
    let killed = false;

    const child = spawn(command, {
      shell: true,
      stdio: ["inherit", "pipe", "pipe"],
    });

    if (onStart) {
      onStart(() => {
        killed = true;
        child.kill("SIGTERM");
      });
    }

    child.stdout.on("data", (data) => { stdout += data.toString(); });
    child.stderr.on("data", (data) => { stderr += data.toString(); });

    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        durationMs: Date.now() - start,
        killed,
      });
    });
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/runner.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/runner.js tests/runner.test.js
git commit -m "feat: add command runner with output capture and kill support"
```

---

### Task 5: Config Loader

**Files:**
- Create: `src/config.js`
- Create: `tests/config.test.js`

**Step 1: Write the failing tests**

```js
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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/config.test.js`
Expected: FAIL — `loadConfig` not found

**Step 3: Write minimal implementation**

```js
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
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/config.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/config.js tests/config.test.js
git commit -m "feat: add config loader with .env file support"
```

---

### Task 6: CLI Entry Point — Main Loop

**Files:**
- Create: `bin/notifybot.js`

**Step 1: Write the CLI entry point**

```js
#!/usr/bin/env node

import { loadConfig } from "../src/config.js";
import { runCommand } from "../src/runner.js";
import { sendMessage, pollForReply } from "../src/telegram.js";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: notifybot <command>");
  console.error("Example: notifybot npm run build");
  process.exit(1);
}

const command = args.join(" ");
const config = loadConfig();
let killFn = null;

async function main() {
  console.log(`Running: ${command}`);

  let shouldRun = true;

  while (shouldRun) {
    shouldRun = false;

    const result = await runCommand(command, {
      onStart: (kill) => { killFn = kill; },
    });

    const status = result.exitCode === 0 ? "SUCCESS" : "FAILED";
    const duration = (result.durationMs / 1000).toFixed(1);
    const text = [
      `${status}: \`${command}\``,
      `Exit code: ${result.exitCode}`,
      `Duration: ${duration}s`,
      "",
      "Reply with: retry | log | kill",
    ].join("\n");

    console.log(`\n${status} (exit ${result.exitCode}, ${duration}s)`);
    console.log("Sending Telegram notification...");

    const sent = await sendMessage({
      token: config.token,
      chatId: config.chatId,
      text,
    });

    console.log("Waiting for your Telegram reply (2 min timeout)...");

    const reply = await pollForReply({
      token: config.token,
      chatId: config.chatId,
      sentMessageId: sent.message_id,
      intervalMs: 2000,
      timeoutMs: 120000,
    });

    if (!reply) {
      console.log("No reply received. Exiting.");
      break;
    }

    console.log(`Reply: "${reply}"`);

    if (reply === "retry") {
      console.log("Retrying...\n");
      shouldRun = true;
    } else if (reply === "log") {
      const logText = result.stdout || result.stderr || "(no output)";
      const truncated =
        logText.length > 4000
          ? logText.slice(-4000) + "\n...(truncated)"
          : logText;
      await sendMessage({
        token: config.token,
        chatId: config.chatId,
        text: `Output:\n\`\`\`\n${truncated}\n\`\`\``,
      });
      console.log("Logs sent to Telegram.");
    } else {
      console.log(`Unknown reply "${reply}". Exiting.`);
    }
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
```

**Step 2: Make it executable and test manually**

```bash
chmod +x bin/notifybot.js
```

**Step 3: Commit**

```bash
git add bin/notifybot.js
git commit -m "feat: add CLI entry point with retry/log reply loop"
```

---

### Task 7: Integration Test

**Files:**
- Create: `tests/integration.test.js`

**Step 1: Write integration test**

```js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runCommand } from "../src/runner.js";
import { sendMessage, pollForReply } from "../src/telegram.js";

describe("integration: command -> notify -> reply", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("runs a command, sends notification, handles 'log' reply", async () => {
    const result = await runCommand("echo integration-test-output");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("integration-test-output");

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes("sendMessage")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, result: { message_id: 10 } }),
        });
      }
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

    const sent = await sendMessage({
      token: "test",
      chatId: "123",
      text: `Command finished with exit ${result.exitCode}`,
    });
    expect(sent.message_id).toBe(10);

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
```

**Step 2: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add tests/integration.test.js
git commit -m "test: add integration test for full command-notify-reply flow"
```

---

### Task 8: Push to GitHub and Test Codespace

**Step 1: Create GitHub repo**

```bash
gh repo create notifybot --public --source=. --push
```

**Step 2: Open a Codespace**

```bash
gh codespace create --repo omarelmahdyexacall/notifybot --branch main
```

**Step 3: Verify devcontainer works**

- Confirm Node 20 is available
- Confirm `npm install` ran via `postCreateCommand`
- Run `npx vitest run` — all tests should pass
- Try `node bin/notifybot.js echo hello` (will fail on missing .env, confirming config validation works)

---

## Summary

| Task | What | Tests |
|------|------|-------|
| 1 | Scaffolding + devcontainer | — |
| 2 | `sendMessage` | 2 tests |
| 3 | `pollForReply` | 2 tests |
| 4 | `runCommand` | 3 tests |
| 5 | `loadConfig` | 3 tests |
| 6 | CLI entry point | Manual |
| 7 | Integration test | 1 test |
| 8 | GitHub + Codespace | Manual |
