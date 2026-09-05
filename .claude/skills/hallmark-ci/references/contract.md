# Output contract & scope

Loaded once per build, at handoff time.

> **CodeIgniter edition.** The output is CodeIgniter 4 views + static `public/assets/`. The framework-conventions rule below resolves to: markup goes in `app/Views/` (layouts/sections/partials), tokens go in `public/assets/css/tokens.css`, dynamic values are `esc()`d, URLs use `base_url()`/`site_url()`. The binding detail is in [`codeigniter.md`](codeigniter.md); this file's general principles still hold.

## Output contract

When producing new work:

- Put design tokens in one place — `public/assets/css/tokens.css` (`:root` custom properties), linked from the layout before any stylesheet that consumes them.
- Name tokens by semantic role, not value. `--color-ink`, not `--color-black`.
- Match CodeIgniter's file conventions — views under `app/Views/`, assets under `public/assets/`, wiring through controllers/routes. Don't reinvent them, and don't introduce a JS framework or a runtime build step the cPanel host can't run.
- Escape every dynamic value on output (`esc()`); compose every URL with `base_url()`/`site_url()`.
- If a project genuinely uses Tailwind or another token pipeline, extend its theme rather than inlining arbitrary values; but a plain CI4 + cPanel project uses hand-written CSS keyed to `tokens.css`.
- **An existing global stylesheet is append-only.** If the project already ships one (`app/globals.css`, `src/index.css`, `src/styles/global.css`), add to it instead of replacing it: keep every `@tailwind` / `@import "tailwindcss"` directive exactly where it is, put Hallmark's `:root` tokens and base rules *below* them, and keep any new `@import` (e.g. `tokens.css`) at the very top of the file, above all other rules. Reuse the project's own token names (`--background`, `--foreground`, a Tailwind `@theme`) where they exist rather than shadowing them with a parallel set. Do a full rewrite only when the user explicitly asks for one: silently dropping a framework's CSS entry directives un-styles the entire app.
- Include a short comment block at the top of the stylesheet naming the genre, the tone the user picked, the palette's anchor hue, and the structural fingerprint. This is the only comment you need.

## Scope and limits

Hallmark is a *taste* skill. It will not:

- Invent product copy. If the user hasn't given you the words, ask.
- Pick a brand identity. It will follow one you give it.
- Enforce a specific style (dark mode, glassmorphism, brutalism). It will execute whichever genre + tone the user committed to.
- Build logic — state management, data fetching, business rules. It is a visual / interaction layer only.

If a request falls outside taste — "build the auth flow", "wire up Stripe" — do the work, but apply Hallmark to the rendered surface.
