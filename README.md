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

## Accounts, notes and chats

Users sign in with email and password (Supabase Auth). Data is stored per user:

| Data | Where | How it's protected |
| --- | --- | --- |
| Notes | Supabase Postgres, table `notes` | Row level security: each user can only read and change their own rows |
| Chat history | MongoDB, collection `chats` | Only reachable through `src/app/api/chats+api.ts`, which checks the user's Supabase token |
| Reminders, feed settings | On the device (AsyncStorage) | Tied to the device's scheduled notifications |

Setup:

1. Create a Supabase project. Run [supabase/migrations/20261103000000_notes.sql](supabase/migrations/20261103000000_notes.sql) in its SQL editor.
2. Create a MongoDB database (for example on MongoDB Atlas) and copy its connection string.
3. Copy `.env.example` to `.env.local` and fill it in. Restart with `npx expo start --clear`.

The first time someone signs in, notes and chats saved on the device by older versions are uploaded to their account.

### Where the keys live

- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are built into the app. Supabase designs these to be public, and row level security protects the data. Never put the Supabase secret or `service_role` key in the app.
- `MONGODB_URI` and `ANTHROPIC_API_KEY` are read only by the server routes in `src/app/api/`. They must never have the `EXPO_PUBLIC_` prefix, or they would be bundled into the app.
- The login session is kept in the iOS Keychain / Android Keystore (`expo-secure-store`). On web it uses the browser's localStorage.
- `.env`, `.env.local` and the other env files are git-ignored. Only `.env.example` is committed.

For production, set the same variables on your server host, not in the app.

## Turn on Claude for the chat

Without an API key the chat runs in offline mode, using an on-device parser that handles common phrasings. For full understanding, add `ANTHROPIC_API_KEY` to `.env.local` and restart `npx expo start`. The key is only read by `src/app/api/assistant+api.ts`, which only answers signed-in users. In development the phone reaches that route through the dev server automatically.

For production builds, deploy the server and set the `origin` option of the `expo-router` plugin in `app.json` to the deployed URL. See [API Routes](https://docs.expo.dev/router/web/api-routes/). EAS Hosting runs routes on Cloudflare Workers, where the MongoDB driver's TCP connections are only partly supported, so test `/api/chats` there or host the API on a Node server.

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
- **Data**: notes and chats sync to the user's account. Reminders stay on the device, because their notifications are scheduled there.

## Project layout

```
src/app/                 Screens (Expo Router). index.tsx is Chat.
src/app/api/             Server routes: assistant (Claude), chats (MongoDB) and news (RSS proxy)
src/lib/server/          Server-only helpers: token check and MongoDB connection
src/lib/supabase/        Supabase client and secure session storage
supabase/migrations/     SQL for the notes table and its access rules
src/lib/assistant/       Intent schema, Claude client, offline parser, chat state machine
src/lib/                 Store, notifications, messaging, dates, notes and news helpers
src/components/          UI pieces per tab, plus shared ui/ components
```

## Checks

```bash
npx tsc --noEmit
npx expo lint
```
