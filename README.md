# notifybot

Wrap any CLI command — get notified on Telegram when it finishes. Reply to take action.

## Setup

1. Create a Telegram bot via @BotFather and copy the token
2. Send any message to your bot, then visit `https://api.telegram.org/bot<TOKEN>/getUpdates` to find your chat_id
3. Copy `.env.example` to `.env` and fill in your values
4. `npm install && npm link`

## Usage

```
notifybot <command>
# Example:
notifybot npm run build
```

When the command finishes, you get a Telegram message. Reply with:
- **retry** — re-run the command
- **log** — get the full output
- **kill** — kill the process (if still running)
