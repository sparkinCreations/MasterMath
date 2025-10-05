# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MathMaster is a React-based educational math application that helps students solve math problems with step-by-step solutions and visual feedback. The application uses AI to generate solutions, explanations, and graphs.

## Architecture

### Component Structure

The application follows a modular architecture with clear separation of concerns:

- **Layout.js**: Main application layout with sidebar navigation using shadcn/ui components. Defines the app shell with navigation between Solver and Progress pages. Uses React Router for routing with `createPageUrl` utility.

- **Pages/**: Top-level page components
  - `Solver.js`: Main problem-solving interface (currently empty/stub)
  - `Progress.js`: User progress tracking page (currently empty/stub)

- **Components/solver/**: Solver-specific UI components
  - `ProblemInput`: Input form for math problems with topic selection and example problems. Handles problem text, topic dropdown (derivatives, integrals, limits, functions, trigonometry, algebra, other), and provides example problems to load.
  - `SolutionDisplay`: Displays AI-generated solutions with step-by-step explanations, final answer, key insights, and common mistakes. Uses Framer Motion for animations.
  - `GraphViewer`: Renders mathematical function graphs using Recharts. Accepts `functionData` prop with `points` array, `title`, and optional `description`.

- **Entities/**: Data schema definitions
  - `ProblemHistory`: JSON schema for problem history storage. Properties include `problem`, `topic`, `solution`, `user_answer`, and `feedback`.

### UI Library

The app uses **shadcn/ui** components with Tailwind CSS for styling. All UI components are imported from `@/components/ui/` including Button, Card, Textarea, Select, Sidebar, etc. The design features gradient backgrounds and colorful, modern styling with purple/blue/green color scheme.

### Key Dependencies

- **React Router**: Client-side routing with `createPageUrl` utility
- **Recharts**: Data visualization for function graphs
- **Framer Motion**: Animations for solution display
- **Lucide React**: Icon library
- **shadcn/ui + Tailwind CSS**: UI component library and styling

## Data Flow

1. User enters problem in `ProblemInput` component (problem text + topic selection)
2. Solution is generated (implementation not visible in current files)
3. `SolutionDisplay` renders the solution with steps, answer, tips, and common mistakes
4. `GraphViewer` visualizes any function data with x/y coordinate points
5. Problem history stored according to `ProblemHistory` schema

## Development Commands

- **Install dependencies**: `npm install`
- **Start dev server**: `npm run dev` (opens at http://localhost:5173)
- **Build for production**: `npm run build`
- **Preview production build**: `npm run preview`

## Base44 API Integration

The app is connected to Base44's backend API for data persistence:
- API file: `src/lib/api.js`
- Base URL: `https://app.base44.com/api/apps/68e2b50dac70d9080d35934f`
- Functions: `fetchProblemHistory()`, `createProblemHistory()`, `updateProblemHistory()`
- The `solveProblem()` function is currently a mock - replace with actual AI API when available

## Important Notes

- Components use the `@/` path alias for imports (e.g., `@/components/ui/button`)
- Solution objects should include: `steps[]`, `answer`, `tips[]`, `common_mistakes[]`, `graph` (optional)
- Graph data should include: `points[]` (with x, y properties), `title`, `description`
- Topic values: "derivatives", "integrals", "limits", "functions", "trigonometry", "algebra", "other"
