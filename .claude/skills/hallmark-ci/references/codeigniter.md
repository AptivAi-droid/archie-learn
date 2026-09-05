# CodeIgniter output contract — the binding emit layer

This is the authoritative output layer for the CodeIgniter edition of Hallmark. **Load it first on every default build, redesign, and component run.** Wherever the design brain or any other reference file says "emit HTML", "write `index.html`", "emit a `.tsx`", or "self-contained page", it means: emit the equivalent artifact described here. The taste rules (macrostructure, themes, slop test, typography, colour, motion) are unchanged — this file only governs *where the bytes land and how they are wired*.

Target stack: **CodeIgniter 4** on **cPanel shared hosting, PHP 8.2+**, no build step required at runtime.

---

## The one-paragraph model

A Hallmark page becomes a **view** in `app/Views/` that extends a **layout** and fills the layout's **sections**. Shared chrome (`<head>`, nav, footer) lives in the layout and in **partials** under `app/Views/partials/`. All styling ships as **static CSS** under `public/assets/css/` — `tokens.css` (the source of truth) plus one or more page/site stylesheets — referenced from the layout with `base_url()`. Any interactivity is **plain vanilla JS** under `public/assets/js/`. A controller renders the view; you tell the user which route to register. Nothing here needs Node to run on the server.

---

## Folder layout

```
app/
  Controllers/
    Home.php                     # renders the view
  Views/
    layouts/
      main.php                   # the base layout: <head>, asset links, sections
    partials/
      nav.php                    # shared nav chrome
      footer.php                 # shared footer chrome
    components/
      button.php                 # reusable component partials (component-scope)
    home.php                     # the page view — extends layouts/main
public/
  assets/
    css/
      tokens.css                 # SOURCE OF TRUTH — all --color-*, --font-*, --space-* …
      site.css                   # base/reset + shared rules
      home.css                   # page-specific rules (optional; can fold into site.css)
    js/
      site.js                    # vanilla JS, progressive enhancement
    fonts/                       # self-hosted font files (preferred for production)
    img/                         # images, SVGs
```

On cPanel, the app's document root is `public/`. Everything under `public/assets/` is served directly by Apache; nothing there is processed by PHP. That is exactly what you want — zero build, zero runtime cost.

---

## The layout (`app/Views/layouts/main.php`)

The layout owns the `<head>`, links the assets in the correct order (**tokens first**), and declares the sections a page fills. It is the only place the Hallmark stamp comment for the *site chrome* appears; the page view carries its own stamp inside its content.

```php
<?php
/**
 * Hallmark · site layout
 * Assets link order is load-bearing: tokens.css MUST precede every stylesheet
 * that references var(--…). base_url() resolves against your configured baseURL.
 */
?>
<!DOCTYPE html>
<html lang="<?= esc($lang ?? 'en') ?>">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= esc($title ?? 'Untitled') ?></title>

  <?php // Fonts: self-host in production; the Google Fonts <link> is a prototype default. ?>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..600&family=Geist:wght@400..600&display=swap" rel="stylesheet">

  <link rel="stylesheet" href="<?= base_url('assets/css/tokens.css') ?>">
  <link rel="stylesheet" href="<?= base_url('assets/css/site.css') ?>">
  <?= $this->renderSection('styles') ?>
</head>
<body>
  <?= $this->include('partials/nav') ?>

  <main>
    <?= $this->renderSection('content') ?>
  </main>

  <?= $this->include('partials/footer') ?>

  <script src="<?= base_url('assets/js/site.js') ?>" defer></script>
  <?= $this->renderSection('scripts') ?>
</body>
</html>
```

`renderSection('styles')` / `renderSection('scripts')` let a page inject its own extra stylesheet or script without touching the layout — use them for page-specific CSS/JS files.

---

## The page view (`app/Views/home.php`)

The view declares which layout it extends, then fills sections. The Hallmark stamp comment goes at the top of the `content` section so it travels with the page markup.

```php
<?= $this->extend('layouts/main') ?>

<?= $this->section('styles') ?>
  <link rel="stylesheet" href="<?= base_url('assets/css/home.css') ?>">
<?= $this->endSection() ?>

<?= $this->section('content') ?>
<?php /* Hallmark · macrostructure: Long Document · tone: editorial-quiet · anchor hue: 60 */ ?>

<section class="hero">
  <h1 class="hero__title"><?= esc($headline) ?></h1>
  <p class="hero__lede"><?= esc($lede) ?></p>
  <a class="btn btn--primary" href="<?= site_url('contact') ?>"><?= esc($cta) ?></a>
</section>

<?php foreach ($features as $f): ?>
  <article class="feature">
    <h2 class="feature__title"><?= esc($f['title']) ?></h2>
    <p class="feature__body"><?= esc($f['body']) ?></p>
  </article>
<?php endforeach; ?>

<?= $this->endSection() ?>
```

Rules that are non-negotiable in views:

- **Escape everything dynamic.** Any value that could originate from data, a database, a form, or a URL parameter goes through `esc()`. `esc($x)` for HTML body context; `esc($x, 'attr')` inside an attribute; `esc($url, 'url')` when composing a URL from data. Static design copy the user handed you can be literal, but when in doubt, escape.
- **Never build URLs by hand.** Internal links use `site_url('path')` (routes) or `base_url('assets/…')` (static files). This keeps the site portable across the cPanel subdomain/subfolder it's deployed under.
- **No business logic in views.** Views render; controllers and models decide. Loops and simple conditionals for presentation are fine; queries and rules are not.
- **The markup inside sections still obeys every taste rule** — macrostructure, hierarchy, the slop-test gates, mobile non-negotiables, typography purity. CI4 wraps the markup; it does not soften it.

---

## Partials (`app/Views/partials/`, `app/Views/components/`)

A partial is a fragment pulled into a layout or view with `$this->include('path', $data)`. Data passed as the second argument is extracted into variables inside the partial.

```php
<?php // app/Views/partials/nav.php ?>
<header class="site-nav">
  <a class="site-nav__brand" href="<?= site_url('/') ?>"><?= esc($brand ?? 'Aptiv') ?></a>
  <nav aria-label="Primary">
    <?php foreach ($nav ?? [] as $item): ?>
      <a href="<?= site_url($item['href']) ?>"><?= esc($item['label']) ?></a>
    <?php endforeach; ?>
  </nav>
</header>
```

Component-scope artifacts (a button, an input, a card) are partials in `app/Views/components/`, pulled in with an explicit data array and documented at the top:

```php
<?php
/**
 * components/button.php
 * @param string $label   button text
 * @param string $href    destination (optional; renders <a> if set, else <button>)
 * @param string $variant 'primary' | 'secondary' (default 'primary')
 * @param string $state   '' | 'loading' | 'disabled' (default '')
 */
$variant = $variant ?? 'primary';
$state   = $state ?? '';
$classes = 'btn btn--' . esc($variant, 'attr') . ($state ? ' is-' . esc($state, 'attr') : '');
?>
<?php if (!empty($href)): ?>
  <a class="<?= $classes ?>" href="<?= site_url($href) ?>"><?= esc($label) ?></a>
<?php else: ?>
  <button class="<?= $classes ?>" type="button"<?= $state === 'disabled' ? ' disabled' : '' ?>>
    <?= esc($label) ?>
  </button>
<?php endif; ?>
```

Its CSS appends to `public/assets/css/components.css` (or `components/button.css`), consuming tokens by name.

---

## The controller + route (state these to the user)

The skill does not need to write a full controller, but it must tell the user the minimal wiring so the view actually renders. Give them both pieces:

```php
// app/Controllers/Home.php
public function index(): string
{
    return view('home', [
        'title'    => 'Aptiv — Homepage',
        'headline' => 'We build the boring parts that keep you online.',
        'lede'     => 'Managed hosting, CodeIgniter apps, and integrations.',
        'cta'      => 'Start a project',
        'features' => [
            ['title' => 'Hosting',       'body' => '…'],
            ['title' => 'Development',   'body' => '…'],
        ],
    ]);
}
```

```php
// app/Config/Routes.php
$routes->get('/', 'Home::index');
```

Escaping note: because the view already `esc()`s on output, pass raw values from the controller — do not double-escape in the controller.

---

## Assets, tokens, and load order

- `tokens.css` is the **source of truth** and lives at `public/assets/css/tokens.css`. It is a plain `:root { … }` block of every `--color-*`, `--font-*`, `--space-*`, `--text-*`, `--ease-*`, `--dur-*`, `--rule-*`, `--radius-*` token the build uses. See [`export-formats.md`](export-formats.md) for the canonical token taxonomy — same tokens, same OKLCH values; only the file location differs.
- **Load order is load-bearing.** `tokens.css` must be linked (or `@import`ed) *before* any stylesheet that references `var(--…)`. In the layout, that means the `tokens.css` `<link>` precedes `site.css` and any page `<link>`. If a page CSS file uses `@import "tokens.css";`, that `@import` must be the first rule in the file or the browser silently drops it.
- **Page CSS references tokens by name, never raw values.** No inline OKLCH/hex in a rule — if you need a value that isn't a token yet, add it to `tokens.css` first, then reference it. (This is slop-test gate 48, unchanged.)
- **Cache-busting on cPanel.** Static assets cache hard. When you change a stylesheet, bump a query string so browsers refetch: `base_url('assets/css/site.css') . '?v=3'`, or centralise a version constant in `app/Config` and append it. Mention this to the user when you edit an existing stylesheet.
- **Fonts.** The Google Fonts `<link>` is a fine prototype default, but for production prefer self-hosted files in `public/assets/fonts/` with `@font-face` in `tokens.css` — it removes the third-party request and the uptime dependency (this mirrors the remote-asset guidance in [`assets.md`](assets.md)). State the tradeoff when you leave a remote font link in.

---

## Optional build pipeline (Vite) — off by default

The default path ships hand-written CSS/JS that runs on any cPanel account with no tooling. Some Aptiv projects have Node available locally and prefer to author with a bundler and **commit the compiled output**. When the user asks for that, document (don't silently assume) this shape:

- Source lives outside the web root, e.g. `resources/css/` and `resources/js/`.
- `vite build` compiles to `public/assets/` with hashed filenames and a `manifest.json`.
- A small view helper reads `public/assets/manifest.json` and emits the hashed `<link>`/`<script>` tags, so views reference logical names and get the hashed file. Provide the helper only when asked.
- **The server still serves plain static files** — cPanel never runs Vite. The build happens on a developer machine or CI; the compiled `public/assets/` is what deploys. If the user has no Node anywhere, this path does not apply — stay on hand-written assets.

Never make the *runtime* depend on npm. cPanel shared hosting has no Node; a build step that must run on the server would break the deploy.

---

## cPanel deployment notes (surface these once, at handoff)

- **Document root = `public/`.** The account's domain/subdomain should point at the app's `public/` directory. If the host forces the doc root to be `public_html/` and the app can't sit above it, the app folders (`app/`, `system/`, `writable/`, `vendor/`) go one level up (outside `public_html/`) and `public_html/` holds the contents of `public/`, with `index.php`'s `$pathsPath`/paths adjusted. Flag this arrangement rather than assuming it.
- **`baseURL`.** Set `app.baseURL` in `app/Config/App.php` (or the `.env` `app.baseURL`) to the real deployed URL including the subfolder if any. `base_url()`/`site_url()` depend on it; wrong value = broken asset links.
- **`writable/` must be writable** (755/775) and **must not be web-accessible** — keep it out of the doc root.
- **PHP 8.2+.** Set the cPanel "MultiPHP" version for the domain to 8.2 or higher. CI 4.5+ needs PHP 8.1+; 8.2/8.3 are the safe targets. Confirm required extensions are on: `intl`, `mbstring`, `json`, plus a DB driver (`mysqli`/`mysqlnd`) if the app uses one.
- **`.htaccess`.** CI4 ships one in `public/` that routes everything through `index.php` and removes `index.php` from URLs. Keep it; on some cPanel stacks you may need to confirm `mod_rewrite` and `AllowOverride All` are enabled for the account.
- **No Composer on the server?** Commit `vendor/` (or upload it) — shared hosting often lacks a usable Composer/CLI. The app must arrive with its dependencies present.

---

## CodeIgniter 3 fallback

CI4 is this edition's default. If the pre-flight scan proves the project is **CodeIgniter 3** (`application/` + `system/` folders, `application/config/config.php`, no `codeigniter4/framework` in composer), translate the emit as follows — the taste rules and the `public/assets/` styling story are identical; only the view API changes:

| Concern | CI4 | CI3 |
| --- | --- | --- |
| Views live in | `app/Views/` | `application/views/` |
| Render a view | `view('home', $data)` (controller) | `$this->load->view('home', $data)` |
| Layout pattern | `$this->extend()` / `section()` / `renderSection()` | No native layouts — use a template view that `$this->load->view()`s a header partial, the body, then a footer partial; or the `Template` library |
| Include a partial | `$this->include('partials/nav', $data)` | `$this->load->view('partials/nav', $data)` |
| Escape output | `esc($x)` | `html_escape($x)` (load `security` helper) |
| Asset / site URL | `base_url('assets/…')`, `site_url('path')` | same, but `$this->load->helper('url')` first |
| Base URL config | `app.baseURL` in `App.php`/`.env` | `$config['base_url']` in `config.php` |

CI3 also runs on PHP 8.2 from 3.1.13+; confirm the project is on a recent 3.1.x before promising 8.2 compatibility. When in doubt which version a project is on, ask — do not guess from a single file.

---

## What does NOT change

Genre detection, macrostructure selection and rotation, the 58 slop-test gates, the mobile non-negotiables (`overflow-x: clip`, `minmax(0,1fr)`, no two-line clickable text, etc.), typography purity (no italic headers), honest-copy discipline, locked tokens, no re-drawn chrome, motion restraint, and the pre-emit self-critique all apply exactly as written elsewhere in this skill. CodeIgniter is the delivery vehicle, not a licence to relax taste.
