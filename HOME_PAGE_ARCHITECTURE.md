# HOME_PAGE_ARCHITECTURE.md

# SIGAT Website — Home Page Architecture Report

> Scope: Inspection/documentation only. Nothing was modified.
> Paths are relative to project root `c:\Users\Lenovo\Desktop\sigat-website`.

---

## 1. PROJECT INFORMATION

| Item | Value |
|------|-------|
| Project name | `sigat-website` (`package.json`) |
| Angular version | `^18.2.0` (`@angular/core`, `@angular/common`, `@angular/router`, etc.) |
| Angular CLI version | `^18.2.3` (`@angular/cli`) |
| TypeScript version | `~5.5.2` |
| Application builder | `@angular-devkit/build-angular:application` (esbuild-based) — `angular.json` |
| Standalone vs NgModules | **Standalone** (every component uses `standalone: true`; no `NgModule` anywhere) |
| sourceRoot | `src` (`angular.json` → `sourceRoot: "src"`) |
| App prefix | `app` |
| main.ts | `src/main.ts` |
| App configuration | `src/app/app.config.ts` |
| Routing config | `src/app/app.routes.ts` |
| Global styles | `src/styles.css` (Tailwind) |
| Global assets config | `angular.json` build & test `assets` |

### Key config files

**`src/index.html`**
- `<base href="/">`, `<html lang="en">`, viewport meta, favicon `/favicon.ico`, Font Awesome 6.5.1 loaded from CDN (`https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css`).

**`src/main.ts`**
- `bootstrapApplication(AppComponent, appConfig)`.

**`src/app/app.config.ts`** — Providers:
- `provideZoneChangeDetection({ eventCoalescing: true })`
- `provideRouter(routes)`
- `provideHttpClient()`
- `provideTranslateService({ lang: 'fr' })` (default language **French**)
- `provideTranslateHttpLoader({ prefix: 'assets/i18n/', suffix: '.json' })`

**`angular.json`** — Build/assets:
- `outputPath: "dist/sigat-website"`
- `browser: "src/main.ts"`, `index: "src/index.html"`, `polyfills: ["zone.js"]`, `tsConfig: "tsconfig.app.json"`
- `assets`:
  - `{ glob: "**/*", input: "src/assets", output: "assets" }`
  - `{ glob: "**/*", input: "public", output: "" }`
- `styles: ["src/styles.css"]`, `scripts: []`
- Production budgets: initial warning 500kB / error 1MB; anyComponentStyle warning 2kB / error 4kB; `outputHashing: "all"`.
- `deploy` builder: `angular-cli-ghpages:deploy`.

### Directory tree

```
src/
├── index.html
├── main.ts
├── styles.css
├── app/
│   ├── app.component.{ts,html,css}      root component (renders <router-outlet/>)
│   ├── app.config.ts
│   ├── app.routes.ts
│   ├── core/                            models + services (translate, navigation, social, media)
│   ├── features/                        routed pages (home, about, expertise, ...)
│   ├── layout/                          main-layout, header, footer, mobile-menu
│   └── shared/                          reusable components + shared/media
├── assets/
│   ├── i18n/{ar,en,fr}.json
│   └── media/hero/*.jpg|mp4
└── (favicon.ico lives in public/, not src/)
```

Directory roles:
- **`core`** — injected root services and domain models. `core/services/translate.service.ts` (RTL/LTR), `core/navigation/*`, `core/social/*`, `core/media/*`, `core/services/mock-data.service.ts`.
- **`features`** — one folder per routed page. Home is `features/home`.
- **`layout`** — chrome around routed pages: header, footer, mobile menu, main layout wrapper (`<router-outlet>`).
- **`shared`** — reusable presentational components (section headers, cards, CTA, stat counter, social links) and a `shared/media` folder with `media-hero` and `media-lightbox` (currently **not used on Home**).

---