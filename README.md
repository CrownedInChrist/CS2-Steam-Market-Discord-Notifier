# Steam Market Discord Notifier Bot

## Features

- Scrapes the Steam Market for specified CS2 items.
- Retrieves float values for listed skins.
- Sends alerts when float values are below your defined threshold.
- Delivers notifications to a Discord channel via webhook.

## Setup

1. Clone the repository:
   git clone <repo-url>
   cd <repo-folder>

2. Install dependencies:
   npm install

3. Add your Steam bot account credentials in config.js.

4. Add your Discord webhook URL and item tracking settings in snipeConfig.js. 

5. Start the float fetcher:
   node index.js
   Enter your 2FA code if prompted.

6. In a new terminal, start the notifier:
   node node.js

The bot is now running and will send Discord notifications when matching items are found.

## Warning
It is strongly recommended to use a separate Steam account (a burner account) for this bot.
