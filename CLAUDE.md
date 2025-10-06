# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MasterMath** is a React-based educational math application that helps students solve math problems with step-by-step solutions and visual feedback. The application uses local JavaScript math libraries (not AI) to generate solutions, explanations, and graphs, with all data stored locally in the browser using IndexedDB.

## Architecture

### Component Structure

The application follows a modular architecture with clear separation of concerns:

- **Layout.jsx**: Main application layout with sidebar navigation using shadcn/ui components. Includes dark mode toggle, header with branding, footer with links, and navigation between all pages. Uses React Router for routing with `createPageUrl` utility from `@/utils`.

- **App.jsx**: Root component that wraps the application with providers (DarkModeProvider, ToastProvider, ConfirmProvider) and defines all routes including Solver, Progress, UserManual, PrivacyPolicy, TermsOfService, and Feedback.

- **Pages/**: Top-level page components
  - `Solver.jsx`: Main problem-solving interface with ProblemInput, SolutionDisplay, and GraphViewer components. Handles solving logic and saves to IndexedDB.
  - `Progress.jsx`: User progress tracking page showing statistics (total problems, this week, topics covered), problem history with filtering by topic/date, export functionality (PDF, CSV, JSON, Markdown), and clear history button with confirmation.
  - `UserManual.jsx`: User documentation and help page
  - `PrivacyPolicy.jsx`: Privacy policy information
  - `TermsOfService.jsx`: Terms of service
  - `Feedback.jsx`: User feedback and support page

- **Components/solver/**: Solver-specific UI components
  - `ProblemInput.jsx`: Input form with topic selection dropdown (derivatives, integrals, limits, functions, trigonometry, algebra, other/arithmetic), problem textarea with dynamic placeholders, solve button with loading state, and example problems for each topic.
  - `SolutionDisplay.jsx`: Displays step-by-step solutions with Framer Motion animations, final answer, key insights (tips), common mistakes to avoid, and export buttons (PDF, JSON, Markdown).
  - `GraphViewer.jsx`: Renders mathematical function graphs using Recharts. Accepts `functionData` prop with `points` array (x, y coordinates), `title`, and optional `description`.

- **Contexts/**:
  - `DarkModeContext.jsx`: Provides dark mode state and toggle function, persists to localStorage, defaults to light mode.

- **Entities/**: Data schema definitions
  - `ProblemHistory.json`: JSON schema for problem history storage in IndexedDB. Properties include `id` (auto-increment), `problem`, `topic`, `solution`, `feedback`, and `createdAt` timestamp.

### UI Library

The app uses **shadcn/ui** components with Tailwind CSS for styling. All UI components are imported from `@/components/ui/` including:
- Button, Card, Textarea, Select, Label
- Sidebar (with SidebarProvider, SidebarContent, SidebarMenu, etc.)
- Toast (for notifications)
- ConfirmDialog (for confirmations)
- DropdownMenu (for export options)

The design features:
- Gradient backgrounds (blue/purple/green)
- Modern, colorful styling with purple/blue/green color scheme
- Dark mode support throughout
- Responsive layout with mobile support

### Key Dependencies

**UI & Routing:**
- **React Router**: Client-side routing with `createPageUrl` utility
- **Recharts**: Data visualization for function graphs
- **Framer Motion**: Animations for solution display
- **Lucide React**: Icon library
- **shadcn/ui + Tailwind CSS**: UI component library and styling

**Math Libraries:**
- **mathjs**: Core math operations and expression parsing
- **algebrite**: Symbolic algebra, calculus, and simplification
- **mathsteps**: Step-by-step algebraic simplification

**Export & Storage:**
- **jspdf**: PDF generation for exports
- **IndexedDB**: Browser-based local storage (via custom `indexedDB.js` utility)

## Data Flow

1. User selects topic and enters problem in `ProblemInput` component
2. On solve, `solveProblem()` in `api.js`:
   - Extracts mathematical expression from natural language using `mathParser.js`
   - Routes to appropriate solver based on topic (algebra, derivatives, integrals, limits, trigonometry, functions, arithmetic)
   - Each solver uses mathjs, algebrite, or mathsteps to compute solution
3. `SolutionDisplay` renders the solution with steps, answer, tips, and common mistakes
4. `GraphViewer` visualizes function data if available (points array with x/y coordinates)
5. Problem saved to IndexedDB via `createProblemHistory()` with problem, topic, solution, feedback, and timestamp
6. Progress page loads all problems from IndexedDB and displays statistics, history, and export options

## Storage Architecture

### IndexedDB Implementation (`src/lib/indexedDB.js`)

The app uses **IndexedDB** for local, browser-based storage (no backend API):
- Database name: `MathMasterDB`
- Object store: `problemHistory`
- Schema: Auto-incrementing `id`, with indexes on `topic` and `createdAt`
- Functions:
  - `initDB()`: Initialize database
  - `getAllProblems()`: Fetch all problems (sorted by date descending)
  - `addProblem(data)`: Add new problem with auto timestamp
  - `updateProblem(id, data)`: Update existing problem
  - `deleteProblem(id)`: Delete problem
  - `clearAllProblems()`: Clear entire history
  - `getProblemsByTopic(topic)`: Filter by topic

### API Layer (`src/lib/api.js`)

Wraps IndexedDB functions and provides:
- `fetchProblemHistory()`: Get all problems
- `createProblemHistory(data)`: Add new problem
- `updateProblemHistory(id, data)`: Update problem
- `clearProblemHistory()`: Clear all
- `solveProblem(problem, topic)`: Main solving logic that routes to appropriate solver

## Math Solvers

### Solver Architecture (`src/lib/solvers/`)

Each solver module exports a solve function that returns a consistent solution object:

```javascript
{
  steps: string[],              // Step-by-step solution
  answer: string,               // Final answer
  tips: string[],               // Key insights
  common_mistakes: string[],    // Common mistakes to avoid
  graph: {                      // Optional graph data
    points: [{x, y}, ...],
    title: string,
    description: string
  }
}
```

**Available Solvers:**
- `algebraSolver.js`: Equations, simplification, factoring (using mathsteps, algebrite)
- `derivativesSolver.js`: Differentiation (using algebrite)
- `integralsSolver.js`: Integration (using algebrite)
- `arithmeticSolver.js`: Basic arithmetic operations (using mathjs)
- `otherSolvers.js`: Limits, trigonometry, functions/graphing (using mathjs, algebrite)

### Math Parser (`src/lib/mathParser.js`)

Utilities for parsing and cleaning user input:
- `parseMathExpression(input)`: Converts common notation to JS-friendly format (x² → x^2, 2x → 2*x, etc.)
- `extractFunctionFromProblem(text)`: Extracts math expression from natural language
- `extractVariable(expr)`: Finds main variable (usually x)
- `isEquation(expr)`: Checks if expression is an equation (contains =)

## Export Functionality

### Export Utilities (`src/lib/exportUtils.js`)

**Progress History Exports:**
- `exportAsCSV(problems, topicLabels)`: CSV with date, topic, problem, solution
- `exportAsJSON(problems)`: JSON array of all problems
- `exportAsMarkdown(problems, topicLabels)`: Markdown grouped by topic
- `exportAsPDF(problems, topicLabels)`: PDF using jsPDF

**Individual Solution Exports:**
- `exportSolutionAsMarkdown(problem, topic, solution, topicLabels)`: Single solution as Markdown
- `exportSolutionAsJSON(problem, topic, solution)`: Single solution as JSON
- `exportSolutionAsPDF(problem, topic, solution, topicLabels)`: Single solution as PDF

All exports trigger browser downloads with appropriate filenames and timestamps.

## Development Commands

- **Install dependencies**: `npm install`
- **Start dev server**: `npm run dev` (opens at http://localhost:5173)
- **Build for production**: `npm run build`
- **Preview production build**: `npm run preview`

## Important Notes

### Path Aliases
- Components use the `@/` path alias for imports (e.g., `@/components/ui/button`, `@/lib/api`)
- Configured in Vite/bundler settings

### Data Structures
- **Solution objects** must include: `steps[]`, `answer`, `tips[]`, `common_mistakes[]`, `graph` (optional)
- **Graph data** must include: `points[]` (with x, y properties), `title`, `description` (optional)
- **Topic values**: "derivatives", "integrals", "limits", "functions", "trigonometry", "algebra", "other" (arithmetic)
- **Topic labels**: Map internal values to display names (e.g., "other" → "Arithmetic")

### Storage Considerations
- All data stored in browser's IndexedDB (persistent across sessions)
- No backend API - fully client-side application
- Users can clear history via UI (with confirmation)
- Export functionality for data portability

### Styling Conventions
- Primary colors: Blue (#3B82F6) and Purple (#9333EA)
- Accent colors: Green, Orange, Amber
- Gradient backgrounds throughout
- Dark mode: Uses Tailwind's `dark:` prefix, controlled by DarkModeContext
- All components support dark mode

### Math Input Format
- Use `*` for multiplication (2*x, not 2x - though parser handles both)
- Use `^` for exponents (x^2, not x²)
- Use standard function names: sin, cos, tan, sqrt, ln, log, exp, abs
- Parser handles common notation and natural language

### Branding
- App name: **MasterMath** (not MathMaster)
- By: sparkinCreations™
- Tagline: "Master math with confidence"
- Links to sparkincreations.com in footer
