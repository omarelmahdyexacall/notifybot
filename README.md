# notifybot

A CLI tool that wraps any shell command, sends you a Telegram notification when it finishes, and lets you take action by replying to the bot.

No more watching terminals. Run your builds, deploys, or tests — walk away — and get pinged on your phone when they're done.

## What It Does

```
notifybot npm run build
```

1. **Runs your command** — captures stdout, stderr, exit code, and duration
2. **Sends a Telegram message** when the command finishes:
   ```
   SUCCESS: `npm run build`
   Exit code: 0
   Duration: 42.3s

   Reply with: retry | log | kill
   ```
3. **Waits for your reply** (2-minute timeout) and acts on it:

| Reply | What happens |
|-------|-------------|
| `retry` | Re-runs the entire command from scratch and notifies you again when done |
| `log` | Sends the full stdout/stderr output to Telegram (truncated to 4000 chars if too long) |
| `kill` | Terminates the running process (works cross-platform: SIGTERM on Linux/Mac, taskkill on Windows) |
| *(no reply)* | Exits after 2-minute timeout |
| *(anything else)* | Exits with "Unknown reply" message |

The retry loop is infinite — you can keep retrying until the command succeeds.

## How It Works Under the Hood

- **Zero dependencies** at runtime — uses Node.js built-in `fetch` (Node 20+) and `child_process`
- Communicates with Telegram via the [Bot HTTP API](https://core.telegram.org/bots/api) directly (no wrapper libraries)
- Polls for replies using `getUpdates` with offset tracking to avoid processing old messages
- Reads config from a `.env` file or environment variables
- Cross-platform process management (Windows + Unix)

### Architecture

```
bin/notifybot.js     CLI entry point — parses args, wires modules, runs the main loop
src/config.js        Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from .env or env vars
src/runner.js        Spawns child processes, captures output, provides kill function
src/telegram.js      sendMessage() and pollForReply() via Telegram Bot HTTP API
```

## Setup

### 1. Create a Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`, follow the prompts, and copy your **bot token**
3. Open a chat with your new bot and send any message (e.g. "hello")
4. Visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in a browser
5. Find `"chat":{"id":123456789}` in the response — that's your **chat ID**

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env`:
```
TELEGRAM_BOT_TOKEN=your-bot-token-here
TELEGRAM_CHAT_ID=your-chat-id-here
```

### 3. Install

```bash
npm install
npm link    # makes 'notifybot' available globally
```

## Usage

```bash
# Basic usage
notifybot echo "hello world"

# Wrap a build
notifybot npm run build

# Wrap tests
notifybot npm test

# Wrap any long-running command
notifybot docker build -t myapp .

# Multiple commands
notifybot "npm install && npm run build && npm test"
```

## Development

This project includes a [devcontainer](.devcontainer/devcontainer.json) configuration for GitHub Codespaces or VS Code Dev Containers. Open in a Codespace and everything is pre-configured (Node 20, dependencies auto-installed).

### Run Tests

```bash
npm test           # run once
npm run test:watch # watch mode
```

There are 11 tests across 4 test files covering:
- Telegram `sendMessage` (correct API call, error handling)
- Telegram `pollForReply` (message matching, timeout)
- Command runner (stdout capture, stderr/exit code, process kill)
- Config loader (env var reading, missing var validation)
- Integration test (full command -> notify -> reply flow)

### Quick Smoke Test

```bash
bash test-codespace.sh
```

## Future Improvements

### High Value
- **Kill during execution** — currently `kill` only works after the command finishes. Add a parallel polling loop during command execution to kill long-running processes mid-run
- **Inline keyboard buttons** — replace text replies with Telegram inline buttons (`reply_markup`) so you just tap instead of typing
- **Multiple notification channels** — add Discord webhook or Slack support alongside Telegram

### Nice to Have
- **CI/CD integration** — add a GitHub Actions workflow that runs tests on push
- **npm publish** — publish to npm so anyone can `npx notifybot <cmd>` without cloning
- **Command chaining** — support `notifybot step1 && step2` with per-step notifications (notify after each step, not just at the end)
- **Custom timeout** — `notifybot --timeout 5m npm run build` to control the reply wait time
- **History** — save command results to a local JSON log for later review
- **Quiet mode** — `notifybot --quiet` to suppress local terminal output (only notify via Telegram)

### Devcontainer Enhancements
- **Custom Dockerfile** — extend the base image with project-specific tools
- **Multi-container setup** — add docker-compose for more complex dev environments
- **Port forwarding** — auto-forward ports for web-based projects
- **Additional VS Code extensions** — add more useful extensions to the devcontainer config
