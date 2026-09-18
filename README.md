# Anchor

Anchor is an Expo phone app for shared caregiving: caregivers create care plans, and patients use a simple daily check-in screen.

## Run locally

1. Copy `.env.example` to `.env` and fill in the Supabase project URL and anon key.
2. In Supabase SQL Editor, run `lib/schema.sql` for a new project. It contains the tables, RLS policies, and pairing functions the app needs.
   For an existing project created before patient undo support, also run `lib/migrations/20260917_patient_log_undo.sql` once.
3. Install and start the app:

   ```bash
   npm install
   npx expo start --tunnel
   ```

The displayed QR code opens the project in Expo Go. For a web preview, use `npx expo start --web`.

## Important setup

Configure a password-recovery redirect URL in Supabase Auth for `anchor://reset-password` (and your deployed web reset URL, if you use the web app). Pairing codes are eight digits and expire after 24 hours. An owner can long-press a patient card to reset their pairing code if the patient needs to reconnect.

## Checks

```bash
npx expo-doctor
npx expo export --platform web
```
