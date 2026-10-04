# Anchor

Anchor is an Expo phone app for shared caregiving: caregivers create care plans, and patients use a simple daily check-in screen.

## Run locally

1. Copy `.env.example` to `.env` and fill in the Supabase project URL and anon key.
2. In Supabase SQL Editor, run `lib/schema.sql` for a new project. It contains the tables, RLS policies, and pairing functions the app needs.
   For an existing project, run the SQL files in `lib/migrations/` in date order once, including `20260929_caregiver_medication_logs.sql` and `20261014_safety_checkins.sql`. Patient pairing requires Anonymous Sign-Ins enabled in Supabase Auth.
3. Install and start the app:

   ```bash
   npm install
   npx expo start --tunnel
   ```

The displayed QR code opens the project in Expo Go for the ordinary care flows. NFC sticker writing and scanning require an installed Android or iOS development/production build because Expo Go does not include the native NFC module. For a web preview, use `npx expo start --web`.

## Morning schedule and NFC check-ins

On the first patient visit each day, Anchor opens the five-question morning survey. The patient can dismiss it and return through **Build today’s schedule**. A caregiver can open the patient's **Schedule** tab, add a place such as “Game room,” write that place to an NFC sticker, and assign it to an activity. The patient then refreshes their schedule and taps **Scan sticker** on that activity at the place. Both patient and caregiver can see the check-in time.

For existing Supabase projects, run `lib/migrations/20260930_activity_checkins.sql` after the earlier migrations. Rebuild the phone app after installing the NFC module; a JavaScript update alone cannot add native NFC support. Sticker writing/scanning needs an NFC-capable phone and a writable NDEF sticker.

## Reminders

Open the app once on each device and allow notifications. Patient medication reminders arrive 15 minutes before scheduled medication. Caregiver medication reminders arrive one hour before scheduled medication. Daily activity reminders arrive five minutes before a scheduled activity.

## Important setup

Configure a password-recovery redirect URL in Supabase Auth for `anchor://reset-password` (and your deployed web reset URL, if you use the web app). Pairing codes are eight digits and expire after 24 hours. An owner can use the new-code action on an unpaired patient card to replace an expired code, or long-press a card to reset pairing.

## Updates for existing projects

Apply `lib/migrations/20261015_ui_fixes.sql` and `lib/migrations/20261015_help_notifications.sql` once after the older migrations. Fresh installs include these definitions in `lib/schema.sql`. See `supabase/README.md` for deploying help notifications and configuring a phone build. Code changes alone do not apply database migrations or deploy the server function.

If Taken/Skipped/Missed reports a row-level-security violation for `medication_log`, apply `lib/migrations/20261015_medication_log_permissions.sql` in the connected project's Supabase SQL Editor. This restores restricted recording policies for owners, editors, and paired patients; viewers and family members remain read-only. Expo rehosting does not install database policies.

Then apply `lib/migrations/20261016_remaining_fixes.sql` to record new medication schedule creation dates and show missing mood data accurately in family status. Historical schedule dates fall back to the parent medication's creation date.

Apply `lib/migrations/20261017_codebase_review.sql` after those migrations. It restores read access for shared viewers without granting editing access or expanding family access, and serializes patient pairing claims to prevent simultaneous requests pairing one session to multiple patients. These definitions are also included in the fresh-install schema.

If the care-plan creator still receives a medication permission error, apply `lib/migrations/20261018_medication_owner_access.sql` in the same hosted project. It checks `patients.created_by` directly, so the owner does not need a duplicate sharing entry or an updated access helper. It can safely be rerun and preserves viewer/family write restrictions.

For false pairing-code expiry after reload, apply `lib/migrations/20261019_pairing_code_status.sql`. It restores direct owner reads and the 24-hour default, repairing null or immediately-expired unused codes. Naturally expired and used codes are preserved; reloading never renews a code.

If Get a new pairing code reports a missing `reset_patient_pairing` or `reset_patients_pairing` function, run `lib/migrations/20261020_reset_patient_pairing.sql`. The reset function previously existed only in the fresh-install schema. This upgrade installs the owner-only function, a compatibility alias for the plural name, and requests a PostgREST schema-cache reload.

## Checks

```bash
npx expo-doctor
npx expo export --platform web
```
