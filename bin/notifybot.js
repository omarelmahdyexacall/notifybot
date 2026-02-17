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
