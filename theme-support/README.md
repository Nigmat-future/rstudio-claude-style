# Experimental: public RStudio theme hooks

This directory is for source-level research and upstream discussion. For normal installation, use the themes in the repository's `themes/` directory.

**The new hooks are not available in an unpatched official RStudio build.** “Stable” describes the example's intended use of public selectors, not released compatibility. Do not replace Claude Terminal Charcoal with this example unless you have built RStudio with the patch. A complete patched IDE build and live end-to-end run remain unverified.

## Contents and baseline

- `rstudio-theme-hooks.patch`: new theme classes, documentation, and a real-IDE end-to-end test.
- `claude-terminal-charcoal-stable.rstheme`: uses the new classes for the affected surfaces instead of compiled class names and first/last-child selectors.
- Baseline: [rstudio/rstudio @ 9c11fb25c2a24c4faa09f79befb1907dc8a825de](https://github.com/rstudio/rstudio/tree/9c11fb25c2a24c4faa09f79befb1907dc8a825de).

| Public class | Surface |
| :--- | :--- |
| `rstheme_primaryWindowFrameHeader` | PrimaryWindowFrame title strip, including Console without tabs |
| `rstheme_toolbar` | The table containing a toolbar's controls |
| `rstheme_windowFrameHeader` | WindowFrame layout container around the header |
| `rstheme_windowFrameContent` | WindowFrame layout container around main or full-size content |

Existing classes remain. The Java changes add names without changing layout, controls, events, or default colors. Recreated content and headers receive the same classes. The names are also declared as CssResource `@external` selectors.

Other RStudio/Ace/GWT selectors may still depend on version. The OS title bar and Assistant iframe are outside this patch's scope.

## Apply and verify

Download this community repository and note the patch's absolute path. From a clean RStudio source checkout at the baseline commit, replace `<community-repo>` below with that path:

```powershell
git apply --check '<community-repo>/theme-support/rstudio-theme-hooks.patch'
git apply '<community-repo>/theme-support/rstudio-theme-hooks.patch'
```

Complete a development build following the baseline's [contribution guide](https://github.com/rstudio/rstudio/blob/9c11fb25c2a24c4faa09f79befb1907dc8a825de/CONTRIBUTING.md). Then run from `e2e/rstudio`:

```powershell
npm ci
npm run typecheck
npx playwright test tests/panes/theme_hooks.test.ts --project=desktop --no-deps --list
npm run test:desktop -- tests/panes/theme_hooks.test.ts --workers=1
```

Follow the baseline's `e2e/rstudio/README.md` for environment setup and commands. Desktop tests must target the patched build. Test discovery (`--list`), TypeScript checks, and CSS parsing do not replace a live IDE run. Do not add classes to the test DOM manually to manufacture a pass.

The test checks hook presence, color changes under light and dark themes, unchanged geometry, and restoration after CSS removal. It should fail on an unpatched build because the hooks are absent.

After the patched build passes verification, install the example through Appearance > Add…, or run this in RStudio from the community repository root:

```r
rstudioapi::addTheme(
  "theme-support/claude-terminal-charcoal-stable.rstheme",
  apply = TRUE
)
```

Existing themes are not overwritten by default. Switch back to Claude Terminal Charcoal to restore the normal theme.

## Verification status and upstream scope

On 2026-10-16, the original files were downloaded from the pinned baseline. `git apply --check`, application, reverse checking, and reverse application all exited 0. The original file bytes were restored exactly. This verification did not include a build, TypeScript checks, or an IDE end-to-end run.

The proposal adds specific theme hooks and relates to [theme documentation discussion #6239](https://github.com/rstudio/rstudio/issues/6239); it does not resolve every issue in that discussion. Publishing this repository does not create an upstream PR or imply upstream acceptance. Contribution agreements, build requirements, and complete runtime verification still follow upstream policy.

The example derives from RStudio's Tomorrow Night Bright and retains AGPL v3. It is not an official Anthropic theme.
