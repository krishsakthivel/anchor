# Anchor

Anchor is an Expo phone app for shared caregiving: caregivers create care plans, and patients use a simple daily check-in screen.

## Run locally

1. Copy `.env.example` to `.env` and fill in the Supabase project URL and anon key.
2. In Supabase SQL Editor, run `lib/schema.sql` for a new project. It contains the tables, RLS policies, and pairing functions the app needs.
   For an existing project, run the SQL files in `lib/migrations/` in date order once, including `20260929_caregiver_medication_logs.sql` so caregivers can record doses they give. Patient pairing requires Anonymous Sign-Ins enabled in Supabase Auth.
3. Install and start the app:

   ```bash
   npm install
   npx expo start --tunnel
   ```

The displayed QR code opens the project in Expo Go. For a web preview, use `npx expo start --web`.

## Reminders

Open the app once on each device and allow notifications. Patient medication reminders arrive 15 minutes before scheduled medication. Caregiver medication reminders arrive one hour before scheduled medication. Daily activity reminders arrive five minutes before a scheduled activity.

## Important setup

Configure a password-recovery redirect URL in Supabase Auth for `anchor://reset-password` (and your deployed web reset URL, if you use the web app). Pairing codes are eight digits and expire after 24 hours. An owner can use the new-code action on an unpaired patient card to replace an expired code, or long-press a card to reset pairing.

## Checks

```bash
npx expo-doctor
npx expo export --platform web
```
