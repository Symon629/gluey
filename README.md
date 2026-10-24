# Gluey

A personal organizer you talk to. Tell the chat what to remember and it turns that into reminders, calendar events, notes and text messages.

| Tab | What it does |
| --- | --- |
| Chat | Understands requests like "remind me to shop for groceries at 10am tomorrow". It asks how to remind you (notification, alarm, text or call), how often, and for appointments how early. It also writes notes and drafts texts. |
| Feed | Asks what topics you like, then shows recent news for them. More/less buttons and in-feed questions tune what you see. |
| Calendar | Month view of everything from Chat, including repeating reminders. Tap an item to mark it done or delete it. |
| Notes | Notes can live inside other notes. Chat can create a note, put it under an existing one, or add to one. |
| Agents | A WebView. The plan for this tab is still open; set a URL to load something there. |

## Run it

This project uses Expo SDK 58, which needs Node.js 22.13+, 24.3+ or 26+. Odd-numbered Node releases such as 25 are not supported. The repo pins Node 24 in `.nvmrc`:

```bash
nvm use
npm install
npx expo start
```

Expo Go for SDK 58 reaches the App Store and Google Play a few weeks after the SDK's October 15, 2026 release. Until then, run the app in a simulator or on a device with a native build:

```bash
npx expo run:ios       # needs Xcode
npx expo run:android   # needs Android Studio
```

Every feature in this app works in Expo Go once the SDK 58 version is out.

## Turn on Claude for the chat

Without an API key the chat runs in offline mode, using an on-device parser that handles common phrasings. For full understanding, give the server an Anthropic API key:

```bash
# .env.local (git-ignored)
ANTHROPIC_API_KEY=sk-ant-...
```

Restart `npx expo start`. The key is only read by the API route in `src/app/api/assistant+api.ts`, which runs on the dev server. It is never bundled into the app. In development the phone reaches that route through the dev server automatically.

For production builds, deploy the server (for example `npx expo export -p web` then `eas deploy`) and set the `origin` option of the `expo-router` plugin in `app.json` to the deployed URL. See [API Routes](https://docs.expo.dev/router/web/api-routes/).

## Point the Agents tab at a web app

```bash
# .env.local
EXPO_PUBLIC_AGENTS_URL=https://your-agents-app.example.com
```

## What works today and what needs more

- **Notifications and alarms** are scheduled on the device and work offline. Android uses a separate high-priority Alarms channel. iOS has no third-party alarm API in Expo yet, so an alarm is a time-sensitive notification.
- **Text and call reminders** are saved with your choice, but delivering an SMS or phone call to you at a set time needs a backend service such as Twilio. Until that exists, those reminders arrive as notifications.
- **Sending a text** opens your Messages app with the recipient and text filled in. iOS and Android require you to tap send yourself.
- **News** comes from Google News RSS. On web it goes through `src/app/api/news+api.ts` because browsers block the direct request.
- **Data** is stored on the device with AsyncStorage. There is no account or sync between devices yet.

## Project layout

```
src/app/                 Screens (Expo Router). index.tsx is Chat.
src/app/api/             Server routes: assistant (Claude) and news (RSS proxy)
src/lib/assistant/       Intent schema, Claude client, offline parser, chat state machine
src/lib/                 Store, notifications, messaging, dates, notes and news helpers
src/components/          UI pieces per tab, plus shared ui/ components
```

## Checks

```bash
npx tsc --noEmit
npx expo lint
```
