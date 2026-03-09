# MasterMath — File Structure Documentation

**Version:** 1.1.0
**By:** sparkinCreations™
**Last Updated:** March 9, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Root Directory](#root-directory)
3. [Source Directory (`src/`)](#source-directory-src)
4. [Components (`src/components/`)](#components-srccomponents)
5. [Pages (`src/pages/`)](#pages-srcpages)
6. [Library (`src/lib/`)](#library-srclib)
7. [Solvers (`src/lib/solvers/`)](#solvers-srclibsolvers)
8. [Contexts (`src/contexts/`)](#contexts-srccontexts)
9. [Hooks (`src/hooks/`)](#hooks-srchooks)
10. [Entities (`src/entities/`)](#entities-srcentities)
11. [Utilities (`src/utils/`)](#utilities-srcutils)
12. [Public Assets (`public/`)](#public-assets-public)
13. [Documentation (`docs/`)](#documentation-docs)

---

## Overview

MasterMath is a fully client-side React application. The project follows a modular architecture with clear separation between UI components, business logic, math solvers, and data management. All processing happens in the browser — there is no backend server.

```
MathMaster/
├── docs/                    # Documentation & assets
├── public/                  # Static assets (images, icons, manifest)
├── src/                     # Application source code
│   ├── components/          # Reusable UI components
│   │   ├── solver/          # Solver-specific components
│   │   └── ui/              # shadcn/ui base components
│   ├── contexts/            # React context providers
│   ├── entities/            # Data schemas & definitions
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Core logic & utilities
│   │   └── solvers/         # Math solver modules
│   ├── pages/               # Top-level page components
│   ├── utils/               # General utility functions
│   ├── App.jsx              # Root component (providers & routes)
│   ├── Layout.jsx           # Main layout (sidebar, header, footer)
│   ├── main.jsx             # Application entry point
│   └── index.css            # Global styles & Tailwind directives
├── index.html               # HTML entry point
├── package.json             # Dependencies & scripts
├── vite.config.js           # Vite bundler configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── postcss.config.js        # PostCSS configuration
└── README.md                # Project overview
```

---

## Root Directory

| File/Folder          | Purpose                                              |
|----------------------|------------------------------------------------------|
| `index.html`         | HTML entry point, includes meta tags and root div     |
| `package.json`       | Project dependencies, scripts, and metadata           |
| `vite.config.js`     | Vite bundler config with React plugin and `@/` alias  |
| `tailwind.config.js` | Tailwind CSS theme and content configuration          |
| `postcss.config.js`  | PostCSS plugins (Tailwind, Autoprefixer)              |
| `README.md`          | Project overview and setup instructions               |
| `CLAUDE.md`          | AI assistant guidance for codebase context            |
| `CHANGELOG.md`       | Version history and release notes                     |
| `CONTRIBUTING.md`    | Contribution guidelines                               |
| `DEPLOYMENT.md`      | Deployment instructions                               |
| `SECURITY.md`        | Security policy                                       |
| `LICENSE`            | Project license                                       |
| `.gitignore`         | Git ignore rules                                      |

---

## Source Directory (`src/`)

The `src/` directory contains all application source code. The root-level files serve as the application's entry points and structural foundation.

| File          | Purpose                                                        |
|---------------|----------------------------------------------------------------|
| `main.jsx`    | Application entry point — renders `App` into the DOM           |
| `App.jsx`     | Root component — wraps app with providers and defines routes   |
| `Layout.jsx`  | Main layout — sidebar navigation, header, footer, dark mode   |
| `index.css`   | Global styles — Tailwind directives and custom CSS             |

---

## Components (`src/components/`)

Components are split into two categories: **solver-specific** components and **base UI** components.

### Solver Components (`src/components/solver/`)

These components make up the main problem-solving interface.

| File                   | Purpose                                                      |
|------------------------|--------------------------------------------------------------|
| `ProblemInput.jsx`     | Input form with topic selector, problem textarea, and examples |
| `SolutionDisplay.jsx`  | Renders step-by-step solutions with animations and export options |
| `GraphViewer.jsx`      | Displays mathematical function graphs using Recharts         |

### UI Components (`src/components/ui/`)

Base UI components built with shadcn/ui and Tailwind CSS. These are generic, reusable building blocks.

| File                  | Purpose                                    |
|-----------------------|--------------------------------------------|
| `button.jsx`          | Button component with variants             |
| `card.jsx`            | Card container with header/content/footer  |
| `textarea.jsx`        | Styled textarea input                      |
| `select.jsx`          | Dropdown select component                  |
| `label.jsx`           | Form label component                       |
| `sidebar.jsx`         | Sidebar navigation component               |
| `toast.jsx`           | Toast notification system                  |
| `confirm-dialog.jsx`  | Confirmation dialog component              |
| `dropdown-menu.jsx`   | Dropdown menu component                    |

### General Components (`src/components/`)

| File                  | Purpose                                               |
|-----------------------|-------------------------------------------------------|
| `ErrorBoundary.jsx`   | Error boundary for graceful error handling in the UI  |

---

## Pages (`src/pages/`)

Each file represents a full page accessible via React Router navigation.

| File                 | Route         | Purpose                                        |
|----------------------|---------------|-------------------------------------------------|
| `Home.jsx`           | `/`           | Landing/home page                               |
| `Solver.jsx`         | `/solver`     | Main math problem-solving interface             |
| `Progress.jsx`       | `/progress`   | Problem history, statistics, and data export    |
| `UserManual.jsx`     | `/user-manual` | Help documentation and usage guide             |
| `FAQ.jsx`            | `/faq`        | Frequently asked questions                      |
| `Feedback.jsx`       | `/feedback`   | User feedback submission                        |
| `PrivacyPolicy.jsx`  | `/privacy`    | Privacy policy                                  |
| `TermsOfService.jsx` | `/terms`      | Terms of service                                |

---

## Library (`src/lib/`)

Core application logic — math processing, data management, and utilities.

| File               | Purpose                                                         |
|--------------------|-----------------------------------------------------------------|
| `api.js`           | API layer — wraps IndexedDB functions and routes to solvers     |
| `indexedDB.js`     | IndexedDB implementation for local data storage                 |
| `mathParser.js`    | Parses user input into mathematical expressions                 |
| `exportUtils.js`   | Export functions for PDF, CSV, JSON, and Markdown               |
| `validation.js`    | Input validation utilities                                      |
| `utils.js`         | General utility functions (e.g., `cn` for class merging)        |

---

## Solvers (`src/lib/solvers/`)

Each solver handles a specific math domain and returns a consistent solution object with `steps`, `answer`, `tips`, `common_mistakes`, and optional `graph` data.

| File                    | Domain                    | Libraries Used          |
|-------------------------|---------------------------|-------------------------|
| `algebraSolver.js`      | Equations, simplification, factoring | mathsteps, algebrite |
| `derivativesSolver.js`  | Differentiation           | algebrite               |
| `integralsSolver.js`    | Integration               | algebrite               |
| `arithmeticSolver.js`   | Basic arithmetic          | mathjs                  |
| `otherSolvers.js`       | Limits, trigonometry, functions/graphing | mathjs, algebrite |

---

## Contexts (`src/contexts/`)

React context providers for global state management.

| File                  | Purpose                                                    |
|-----------------------|------------------------------------------------------------|
| `DarkModeContext.jsx` | Provides dark mode state and toggle, persists to localStorage |

---

## Hooks (`src/hooks/`)

Custom React hooks for reusable logic.

| File               | Purpose                                  |
|--------------------|------------------------------------------|
| `usePageTitle.js`  | Sets the document title for each page    |

---

## Entities (`src/entities/`)

Data schema definitions used for structuring stored data.

| File                   | Purpose                                               |
|------------------------|-------------------------------------------------------|
| `ProblemHistory.json`  | JSON schema for problem history records in IndexedDB  |

---

## Utilities (`src/utils/`)

General-purpose utility functions.

| File          | Purpose                                              |
|---------------|------------------------------------------------------|
| `index.js`    | Exports `createPageUrl` for React Router navigation  |

---

## Public Assets (`public/`)

Static files served directly by the web server (images, icons, manifest, etc.).

---

## Documentation (`docs/`)

Project documentation and visual assets.

| File                    | Purpose                          |
|-------------------------|----------------------------------|
| `screenshot.png`        | Application screenshot           |
| `FILE_STRUCTURE.md`     | This file — file organization docs |

---

## Design Conventions

- **Path alias:** `@/` maps to `src/` for clean imports (e.g., `@/components/ui/button`)
- **Naming:** PascalCase for components/pages, camelCase for utilities/hooks
- **Styling:** Tailwind CSS with `dark:` variants, gradient backgrounds (blue/purple/green)
- **Storage:** All data stays in the browser via IndexedDB — no server calls
- **Exports:** Solutions and history can be exported as PDF, CSV, JSON, or Markdown

---

*Built with care by sparkinCreations™ — Software that respects users.*
