# MasterMath — How the App Works

**Version:** 1.2.0
**By:** sparkinCreations™
**Last Updated:** March 9, 2026

---

## Table of Contents

1. [The Big Picture](#the-big-picture)
2. [What Happens When You Open the App](#what-happens-when-you-open-the-app)
3. [The Solving Flow (Step by Step)](#the-solving-flow-step-by-step)
4. [How the Math Actually Gets Solved](#how-the-math-actually-gets-solved)
5. [How Your Data is Stored](#how-your-data-is-stored)
6. [How Pages and Navigation Work](#how-pages-and-navigation-work)
7. [How Dark Mode Works](#how-dark-mode-works)
8. [How Graphs are Drawn](#how-graphs-are-drawn)
9. [How Exporting Works](#how-exporting-works)
10. [How Everything Connects (Architecture Diagram)](#how-everything-connects-architecture-diagram)

---

## The Big Picture

MasterMath is a **fully client-side** app. That means:

- Everything runs **in your browser** — no servers, no accounts, no internet required after the page loads.
- Math problems are solved using **JavaScript math libraries** (mathjs, algebrite, mathsteps) — not AI.
- Your problem history is stored in **IndexedDB**, a database built into your browser.
- You can export your work as **PDF, CSV, JSON, or Markdown** files.

Think of it like a calculator on steroids — it runs entirely on your device.

---

## What Happens When You Open the App

Here's the startup sequence in plain English:

```
1. Browser loads index.html
2. index.html loads main.jsx (the entry point)
3. main.jsx renders the App component
4. App wraps everything in providers:
   - ErrorBoundary    → Catches crashes gracefully
   - DarkModeProvider → Manages light/dark theme
   - ToastProvider    → Manages popup notifications
   - ConfirmProvider  → Manages confirmation dialogs
   - Router           → Manages page navigation
5. Inside the Router, Layout renders:
   - Sidebar (navigation menu)
   - Header (logo, dark mode toggle)
   - The current page (based on URL)
   - Footer (links, branding)
```

The app is now ready. The sidebar lets you navigate between pages, and the URL updates without reloading the browser (this is called client-side routing).

---

## The Solving Flow (Step by Step)

This is the core feature. Here's exactly what happens when you solve a math problem:

### Step 1: User Input
You interact with the **Solver page** (`pages/Solver.jsx`), which contains three components:

| Component | What It Does |
|-----------|-------------|
| **ProblemInput** | The form where you pick a topic and type your problem |
| **SolutionDisplay** | Shows the step-by-step solution after solving |
| **GraphViewer** | Draws a graph if the problem involves a function |

### Step 2: You Click "Solve Problem"
When you hit the button, here's the chain of events:

```
ProblemInput validates your input
    ↓
Solver.jsx calls handleSolve()
    ↓
handleSolve() calls solveProblem(problem, topic) from api.js
    ↓
solveProblem() does three things:
    1. Extracts the math expression from your text (mathParser.js)
    2. Routes to the correct solver based on your topic
    3. Returns a solution object
    ↓
Solver.jsx receives the solution and updates the screen:
    - setSolution(result)     → SolutionDisplay shows the steps
    - setGraphData(result.graph) → GraphViewer draws the graph
    ↓
The problem is saved to IndexedDB via createProblemHistory()
    ↓
A success toast notification appears
```

### Step 3: The Solution Object
Every solver returns the same structure:

```javascript
{
  steps: [              // Each step of the solution
    "Step 1: ...",
    "Step 2: ...",
    "Step 3: ..."
  ],
  answer: "x = 3",     // The final answer
  tips: [               // Helpful insights
    "Remember that..."
  ],
  common_mistakes: [    // Pitfalls to avoid
    "Don't forget to..."
  ],
  graph: {              // Optional — only for graphable functions
    points: [{x: -5, y: 25}, {x: 0, y: 0}, ...],
    title: "f(x) = x^2",
    description: "A parabola opening upward"
  }
}
```

This consistent structure is what makes everything work — every solver speaks the same "language," so the display components always know what to expect.

---

## How the Math Actually Gets Solved

### The Parser (`lib/mathParser.js`)
Before any solving happens, your input needs to be cleaned up. The parser:

- Converts `x²` to `x^2`
- Converts `2x` to `2*x`
- Strips out natural language like "Find the derivative of"
- Identifies the variable (usually `x`)

### The Solvers (`lib/solvers/`)
Each solver is a separate file that specializes in one type of math:

| Solver File | What It Solves | Library Used |
|-------------|---------------|-------------|
| `algebraSolver.js` | Equations, simplification, factoring | mathsteps + algebrite |
| `derivativesSolver.js` | Derivatives (differentiation) | algebrite |
| `integralsSolver.js` | Integrals (integration) | algebrite |
| `arithmeticSolver.js` | Basic math (add, subtract, etc.) | mathjs |
| `otherSolvers.js` | Limits, trig, functions & graphing | mathjs + algebrite |

### The Router (`lib/api.js` → `solveProblem()`)
The `solveProblem()` function acts as a traffic controller. Based on the topic you selected, it sends the expression to the right solver:

```
Topic: "derivatives"  →  solveDerivative(expression)
Topic: "integrals"    →  solveIntegral(expression)
Topic: "algebra"      →  solveAlgebra(expression)
Topic: "limits"       →  solveLimit(expression)
Topic: "trigonometry"  →  solveTrigonometry(expression)
Topic: "functions"    →  solveFunctions(expression)
Topic: "other"        →  solveArithmetic(expression)
```

If no topic matches, it tries to auto-detect from keywords in your input (e.g., "derivative" → derivatives solver).

---

## How Your Data is Stored

### IndexedDB — Your Local Database
MasterMath uses **IndexedDB**, which is a database built into every modern browser. No server needed.

```
Browser
  └── IndexedDB
       └── Database: "MathMasterDB"
            └── Object Store: "problemHistory"
                 ├── Record { id: 1, problem: "x^2+3x", topic: "derivatives", solution: {...}, createdAt: "..." }
                 ├── Record { id: 2, problem: "2x+5=11", topic: "algebra", solution: {...}, createdAt: "..." }
                 └── ...
```

### The Data Layer
There are two files that handle storage:

| File | Role |
|------|------|
| `lib/indexedDB.js` | Low-level database operations (open, read, write, delete) |
| `lib/api.js` | High-level wrapper that pages actually use |

Pages never talk to IndexedDB directly. They call functions from `api.js`, which calls `indexedDB.js`:

```
Page (Solver.jsx, Progress.jsx)
    ↓ calls
api.js (createProblemHistory, fetchProblemHistory, clearProblemHistory)
    ↓ calls
indexedDB.js (addProblem, getAllProblems, clearAllProblems)
    ↓ reads/writes
Browser's IndexedDB
```

### What Gets Stored
Each solved problem saves:

| Field | Description |
|-------|-------------|
| `id` | Auto-generated unique number |
| `problem` | The original problem text you typed |
| `topic` | The topic you selected (e.g., "algebra") |
| `solution` | The full solution object (steps, answer, tips, mistakes) |
| `feedback` | Status message (e.g., "Solved successfully") |
| `createdAt` | Timestamp of when you solved it |

---

## How Pages and Navigation Work

MasterMath uses **React Router** for navigation. Instead of loading a new HTML page every time you click a link, React swaps out just the content area while the sidebar, header, and footer stay in place.

### The Route Map

| URL Path | Page Component | What It Shows |
|----------|---------------|---------------|
| `/` | Home | Landing page |
| `/solver` | Solver | The math solving interface |
| `/progress` | Progress | Your history, stats, and exports |
| `/usermanual` | UserManual | How to use the app |
| `/faq` | FAQ | Frequently asked questions |
| `/feedback` | Feedback | Submit feedback |
| `/privacypolicy` | PrivacyPolicy | Privacy info |
| `/termsofservice` | TermsOfService | Terms info |

### How Navigation Flows

```
User clicks "Solver" in sidebar
    ↓
React Router sees URL change to /solver
    ↓
Router renders <Solver /> inside <Layout>
    ↓
Layout stays the same (sidebar, header, footer)
Only the content area changes
```

The `createPageUrl()` helper converts page names to URLs: `createPageUrl("Solver")` → `"/solver"`.

---

## How Dark Mode Works

Dark mode is managed by the **DarkModeContext** — a React context that shares the theme state across all components.

### The Flow

```
1. On app load:
   - Check localStorage for saved preference
   - Default to light mode if none saved

2. When you click the moon/sun icon:
   - toggleDarkMode() flips the state
   - The "dark" class is added/removed from <html>
   - Preference is saved to localStorage

3. Every component uses Tailwind's dark: prefix:
   - "bg-white dark:bg-gray-800"
   - Light mode? → bg-white
   - Dark mode?  → bg-gray-800
```

Because the context wraps the entire app, every component automatically reacts to the theme change.

---

## How Graphs are Drawn

The **GraphViewer** component uses **Recharts** (a React charting library) to draw function graphs.

### What It Needs
The solver returns graph data as part of the solution:

```javascript
graph: {
  points: [
    { x: -5, y: 25 },
    { x: -4, y: 16 },
    { x: -3, y: 9 },
    // ... many points to make a smooth curve
    { x: 5, y: 25 }
  ],
  title: "f(x) = x²",
  description: "A parabola opening upward",
  solutions: [2, -2]  // Optional x-values to highlight
}
```

### How It Renders

```
points array → Recharts LineChart draws the curve
solutions array → Green dashed vertical lines mark solutions
title → Shown in the card header
description → Shown below the graph
```

The graph includes axis lines at x=0 and y=0, a gradient-colored curve (blue to purple), and a tooltip that shows exact coordinates when you hover.

---

## How Exporting Works

MasterMath can export your data in multiple formats via `lib/exportUtils.js`.

### Individual Solutions (from Solver page)
After solving a problem, you can export that single solution:

| Format | What You Get |
|--------|-------------|
| **PDF** | Formatted document with steps, answer, tips (uses jsPDF) |
| **Markdown** | `.md` file with structured headings |
| **JSON** | Raw data file with all solution fields |

### Full History (from Progress page)

| Format | What You Get |
|--------|-------------|
| **PDF** | All problems in a formatted document |
| **CSV** | Spreadsheet-compatible table |
| **JSON** | Array of all problem records |
| **Markdown** | Problems grouped by topic |

All exports trigger a **browser download** — the file is generated in JavaScript and downloaded directly. No server involved.

---

## How Offline Mode Works

MasterMath includes a **custom service worker** (`public/sw.js`) that makes the entire app work offline.

### The Strategy: Cache-First

```
1. On first visit:
   - Service worker installs and caches the app shell
     (index.html, manifest.json, favicons)
   - As you browse, JS/CSS/image assets are cached on fetch

2. On subsequent visits:
   - Cached assets are served instantly (no network wait)
   - Non-hashed assets are revalidated in the background (stale-while-revalidate)
   - Hashed assets (Vite builds like index-BhaDqFn9.js) are permanent — never revalidated

3. When offline:
   - Everything serves from cache
   - Navigation requests serve index.html (so client-side routing works)
   - Math solving works because all libraries are cached locally

4. When a new version deploys:
   - New service worker installs in the background
   - Old caches from previous versions are cleaned up
   - An update banner prompts the user to refresh
```

### Key Files

| File | Role |
|------|------|
| `public/sw.js` | The service worker — caching, fetching, version management |
| `src/hooks/useServiceWorker.js` | Registers SW, checks for updates every 30 min, shows update banner |
| `src/App.jsx` | Contains the UpdateBanner component |

---

## How Input History Works

The Solver page tracks your recent inputs in memory (not persisted to storage):

```
1. When you solve a problem, the input is added to the history array (max 20)
2. Press ↑ (up arrow) in the input area to recall the previous problem
3. Press ↓ (down arrow) to go forward through history
4. History resets when you refresh the page
```

This is managed by `inputHistory` and `historyIndex` state in `Solver.jsx`, passed to `ProblemInput.jsx` as props.

---

## How Everything Connects (Architecture Diagram)

Here's how the major pieces fit together:

```
┌─────────────────────────────────────────────────────────┐
│                     Browser Window                       │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              App.jsx (Providers)                  │   │
│  │  ErrorBoundary → DarkMode → Toast → Confirm      │   │
│  │                                                   │   │
│  │  ┌─────────────────────────────────────────────┐ │   │
│  │  │           Layout.jsx                         │ │   │
│  │  │  ┌──────────┐  ┌──────────────────────────┐ │ │   │
│  │  │  │ Sidebar  │  │   Current Page            │ │ │   │
│  │  │  │          │  │                            │ │ │   │
│  │  │  │ - Home   │  │  ┌──────────────────────┐ │ │ │   │
│  │  │  │ - Solver │  │  │  Page Components     │ │ │ │   │
│  │  │  │ - Prog.  │  │  │  (ProblemInput,      │ │ │ │   │
│  │  │  │ - Manual │  │  │   SolutionDisplay,   │ │ │ │   │
│  │  │  │ - FAQ    │  │  │   GraphViewer...)     │ │ │ │   │
│  │  │  │ - etc.   │  │  └──────────┬───────────┘ │ │ │   │
│  │  │  └──────────┘  └─────────────┼─────────────┘ │ │   │
│  │  └──────────────────────────────┼───────────────┘ │   │
│  └─────────────────────────────────┼─────────────────┘   │
│                                    │                      │
│              ┌─────────────────────┼──────────┐          │
│              │           lib/      │          │          │
│              │                     ▼          │          │
│              │  ┌──────────────────────────┐  │          │
│              │  │       api.js             │  │          │
│              │  │  (routes to solvers,     │  │          │
│              │  │   manages storage)       │  │          │
│              │  └─────┬──────────┬─────────┘  │          │
│              │        │          │             │          │
│              │        ▼          ▼             │          │
│              │  ┌──────────┐ ┌─────────────┐  │          │
│              │  │ solvers/ │ │ indexedDB.js │  │          │
│              │  │          │ │             │  │          │
│              │  │ algebra  │ │  Read/Write │  │          │
│              │  │ derivs   │ │  to browser │  │          │
│              │  │ integrals│ │  database   │  │          │
│              │  │ arith.   │ └──────┬──────┘  │          │
│              │  │ other    │        │         │          │
│              │  └──────────┘        │         │          │
│              └──────────────────────┼─────────┘          │
│                                     │                     │
│                                     ▼                     │
│                              ┌─────────────┐             │
│                              │  IndexedDB   │             │
│                              │  (Browser)   │             │
│                              └─────────────┘             │
└─────────────────────────────────────────────────────────┘
```

### Data Flow Summary

```
User types problem → ProblemInput validates → Solver.jsx calls api.js
    → mathParser cleans input → Correct solver runs → Solution returned
    → SolutionDisplay renders steps → GraphViewer draws graph
    → Problem saved to IndexedDB → Toast confirms success
```

---

*Built with care by sparkinCreations™ — Software that respects users.*
