<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules

- Finance data is stored as one JSON snapshot per user in `public.finance_snapshots` (RLS: owner only); the dashboard autosaves the whole snapshot. Why: keeps the existing client-side data model unchanged while isolating each user.
- The dashboard lives in `src/components/FinanceDashboard.tsx` and is mounted only under `src/routes/_authenticated/` (`/painel`); `/` just redirects. Why: the dashboard must never render without a session.
- Auth uses the generated `@/integrations/supabase/client` (email/password) against the user's external Supabase project; never hand-roll Auth REST calls. Why: session refresh and storage are handled by supabase-js.
- Pre-login localStorage data is handed once to the first account that signs in on a browser, then a per-user cache key is used. Why: avoids leaking one person's data to another account on a shared device.
