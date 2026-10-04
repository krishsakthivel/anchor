# Help notification deployment

The client confirms that a request was saved, not that a caregiver received it.
Help requests are saved independently of push delivery. The outbox retries failed
sends and records Expo tickets/receipts. Delivery is at least once: a worker crash
after Expo accepts a push but before its ticket is saved may produce a duplicate.

## Database

For a fresh project run `lib/schema.sql`. For an existing project apply the older
dated migrations first, then `lib/migrations/20261015_ui_fixes.sql` and
`lib/migrations/20261015_help_notifications.sql`,
`lib/migrations/20261015_medication_log_permissions.sql`, and
`lib/migrations/20261016_remaining_fixes.sql` once. The last migration adds schedule
creation dates and distinguishes a missing mood update in family status.
Then apply `lib/migrations/20261017_codebase_review.sql` for shared-viewer reads
and serialized patient pairing claims. Fresh installs include all of these fixes.
The vital constraint preserves
old invalid readings but rejects invalid new inserts and updates. These migrations
have not been applied to your hosted project by this change.

## Server

1. Link the Supabase CLI to your project.
2. Generate a random server-only `SAFETY_DISPATCH_SECRET` and set it using Supabase
   secrets. Never put it or a service-role key in an EXPO_PUBLIC environment variable.
3. Deploy `send-safety-notifications`. Its config disables gateway JWT verification;
   the function itself verifies each patient's JWT and paired patient ID. Scheduled
   worker requests must instead supply the dispatch secret.
4. If Expo push access-token security is enabled for your project, configure the
   server-only `EXPO_ACCESS_TOKEN` secret too.
5. Configure a server scheduler (for example Supabase Cron with secrets in Vault)
   to POST `{}` every minute to
   `https://YOUR_PROJECT.supabase.co/functions/v1/send-safety-notifications`, with
   `Content-Type: application/json` and `x-dispatch-secret: YOUR_SECRET`. This handles
   pending retries even if the patient's client disconnects, and checks receipts
   at least 15 minutes after acceptance. Do not embed the secret in public SQL or
   check it into the repository.

Example deployment command:

```sh
supabase functions deploy send-safety-notifications
```

## Phone build

Configure FCM/APNs push credentials for the EAS project and build an installed
development or production app. Expo Go/web do not provide this help-push flow.
The caregiver uses Settings → Enable help notifications to register each phone.
Signing out removes that phone's registration before ending the session.

The notification deliberately omits names, clinical details, and patient IDs.
It asks the caregiver to open Anchor. An open caregiver home subscribes to
authorized safety-check-in inserts and reloads its status.

## Verification

Use disposable test accounts: register a caregiver phone, submit a patient help
request, verify a background push, then check `safety_notification_jobs` progresses
from pending to accepted and later delivered. A delivered receipt means the push
provider accepted it, not that a human read it. Test revoked caregiver access,
sign-out cleanup, and disabled notification permission. None of these live delivery
checks were performed during the local implementation tests.
