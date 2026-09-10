# The Nest

## Connect to a different Supabase database

The browser client is configured exclusively from environment variables, so no
database URL or public key is stored in source control.

1. In the target Supabase project, open **Project Settings → API**.
2. Copy the **Project URL** and the publishable key.
3. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_PUBLISHABLE_KEY` to those values. The `.env` file is ignored by Git.
4. Apply the SQL files in `supabase/migrations/` to the target project in their
   timestamp order. This creates the messaging tables, policies, functions, and
   avatar storage required by the app.
5. Deploy the `send-otp` Edge Function to the same Supabase project and
   configure any function secrets it requires.

After changing `.env`, restart the Vite development server. The application now
stops immediately with a clear configuration error if either required setting is
missing, rather than attempting to initialise a client with invalid credentials.

Never place a Supabase secret key in `VITE_SUPABASE_PUBLISHABLE_KEY`: Vite exposes
all variables prefixed with `VITE_` to the browser. Keep server-only credentials
unprefixed, such as `SUPABASE_SECRET_KEY`.
