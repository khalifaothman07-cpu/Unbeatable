# Accounts and the visit log

Who opened the site, when, and what they looked at — plus an optional Google
sign-in that puts a name to it.

## What it does

Every visitor's browser mints a `visitor_id` (a uuid in `localStorage`) the
first time it arrives, and every page view is written to `public.visits`.
That happens for **everyone**, signed in or not — there is no wall, and the
site works exactly as before if the log is unreachable.

Signing in with Google adds a `profiles` row and stamps the visitor's id onto
it. Because `visitor_id` survives the sign-in, signing in names everything
that browser did **before** it signed in, not just afterwards. That is the
whole design, and it is why the login can be optional without costing you the
numbers.

The log is at **`/admin.html`**. It is not linked from the nav.

## The one-time setup you have to do

Nothing below is optional if you want the Google button to work. Until it is
done, visit tracking already works — but every visitor stays anonymous and
`/admin.html` will not let even you in, because there is no way to sign in.

### 1. Create a Google OAuth client

1. Go to <https://console.cloud.google.com/> and create a project (any name).
2. **APIs & Services → OAuth consent screen**
   - User type: **External**, then **Create**
   - App name: `KAZ6`, user support email: your address
   - Developer contact: your address
   - Save through the remaining steps. You do **not** need to submit for
     verification — an unverified app can still sign in up to 100 accounts,
     which is far past what this site needs.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `KAZ6 web`
   - **Authorised redirect URI** — this must be exact:
     ```
     https://ngtpeamcaxdtghimdspz.supabase.co/auth/v1/callback
     ```
   - Create, then copy the **Client ID** and **Client secret**.

### 2. Turn the provider on in Supabase

1. Supabase dashboard → **Authentication → Sign In / Providers → Google**
2. Enable it, paste the Client ID and Client secret, save.

### 3. Tell Supabase where it is allowed to send people back to

**Authentication → URL Configuration**

- **Site URL**: your Netlify address (`https://<your-site>.netlify.app`, or
  `https://kaz6.com` once the domain is connected)
- **Redirect URLs** — add every origin the games are served from:
  ```
  https://<your-site>.netlify.app/**
  ```
  Add the custom domain too when there is one. A redirect back to an origin
  that is not on this list is refused, and the sign-in silently fails.

### 4. Sign in once

Open `/admin.html` and sign in with **khalifaothman07@gmail.com**.

That address is stored in `public.app_settings` under `owner_email`. The
`handle_new_user` trigger reads it and adds you to `public.admins` on first
sign-in — which is the only way you can become an admin, and it is automatic
because you cannot know your own user id until you have signed in at least
once.

To hand the dashboard to a different address later, change the setting:

```sql
update public.app_settings set value = 'someone@example.com' where key = 'owner_email';
```

Anyone already in `public.admins` stays there; remove them by hand if you
mean to take it away.

## Who can see what

| | anon (anyone with the publishable key) | you |
|---|---|---|
| `visits` | INSERT only | SELECT |
| `profiles` | nothing | all rows |
| `luluaa_games` / `fareej_games` | read/write by room code | same |

`visits` is the one table in this project where SELECT is deliberately closed.
The games' tables must let `anon` read, because Supabase Realtime cannot work
otherwise — the standing rule there is *don't put anything in a snapshot you
wouldn't hand a stranger*. This table is the inverse: a stranger holding the
publishable key can add a row about themselves and can never read one back.

There is no `UPDATE` or `DELETE` policy on `visits` at all, so it is
append-only, and `visits_purge_stale()` has `EXECUTE` revoked from `PUBLIC` —
not just from `anon`, because Postgres grants `EXECUTE` to `PUBLIC` by default
and revoking from `anon` alone would leave a table-wiping function callable by
anyone with the key.

Rows older than **180 days** are deleted nightly by a `pg_cron` job.

### The honest limit

Because the browser has to be able to write a visit, `INSERT` is open to
anyone holding the publishable key — which is anyone who views source. The
column length caps stop the obvious junk, and nothing that goes in can be
read back or edited, but somebody determined could still pad the table with
made-up rows. That is inherent to any client-side analytics that doesn't sit
behind a server, and at this site's profile it is not worth a Netlify
function to close. If it ever happens, the tell is a flood of rows sharing
one `visitor_id` or a nonsense `path`, and the fix is a rate limit in front
of the insert.

Numbers are also softer than they look, and the dashboard says so under the
table: a visitor is **one browser**, so clearing site data makes someone new,
and the same person on a phone and a laptop counts twice until they sign in
on both.

## Turning it invite-only

The scaffold for a hard gate is already there and switched off:

```sql
insert into public.app_settings (key, value) values ('invite_only', 'true')
  on conflict (key) do update set value = 'true';
insert into public.allowlist (email) values ('someone@example.com');
```

With that on, `handle_new_user` refuses to create an account for any address
not in `public.allowlist`. Note what this does and does not do: it stops
people **signing in**. It does not stop them browsing, because the site has no
wall — that would be a much larger change, and a login wall in front of a
portfolio is a good way to make sure nobody sees it.

## Files

| Path | What it is |
|---|---|
| `js/account.js` | The whole client — session, Google sign-in, visit logging, the nav chip. **The only copy.** |
| `js/admin.js` | The dashboard: fetch, aggregate, draw |
| `css/admin.css` | Dashboard styles |
| `admin.html` | The private page |
| `apps/*/src/state/account.ts` | A loader that pulls `js/account.js` in at runtime, so the games do not bundle a second copy |
| `apps/*/src/state/useAccountName.ts` | Records the visit, and puts your name on your seat |

## What is deliberately not tracked

No IP addresses, no fingerprinting, no third-party analytics script, and no
cross-site anything. A `visitor_id` is a random number in one browser's
storage: clearing site data makes someone a new visitor, and the same person
on a phone and a laptop counts twice until they sign in on both. The
dashboard says so under the table rather than letting the numbers imply more
precision than they have.
