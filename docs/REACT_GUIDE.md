# Learning React Through MasterMath

**Version:** 1.2.0
**By:** sparkinCreations™
**Last Updated:** March 9, 2026

A practical guide to understanding React using real code from this project. If you know vanilla JavaScript, you're already halfway there.

---

## Table of Contents

1. [React vs Vanilla JS — The Key Differences](#react-vs-vanilla-js--the-key-differences)
2. [JSX — HTML Inside JavaScript](#jsx--html-inside-javascript)
3. [Components — Reusable Building Blocks](#components--reusable-building-blocks)
4. [Props — Passing Data to Components](#props--passing-data-to-components)
5. [State — Data That Changes](#state--data-that-changes)
6. [useEffect — Doing Things at the Right Time](#useeffect--doing-things-at-the-right-time)
7. [Event Handling — Responding to Users](#event-handling--responding-to-users)
8. [Conditional Rendering — Show/Hide Based on Data](#conditional-rendering--showhide-based-on-data)
9. [Lists and Looping — Rendering Arrays](#lists-and-looping--rendering-arrays)
10. [Context — Sharing Data Across Components](#context--sharing-data-across-components)
11. [Custom Hooks — Reusable Logic](#custom-hooks--reusable-logic)
12. [React Router — Page Navigation Without Reloads](#react-router--page-navigation-without-reloads)
13. [The Component Tree — How It All Fits Together](#the-component-tree--how-it-all-fits-together)
14. [Common Patterns You'll See in This Codebase](#common-patterns-youll-see-in-this-codebase)
15. [Glossary](#glossary)

---

## React vs Vanilla JS — The Key Differences

In vanilla JS, you manually find elements and update them:

```javascript
// Vanilla JS — you manage the DOM yourself
const button = document.querySelector('#solve-btn');
const output = document.querySelector('#result');

button.addEventListener('click', () => {
  output.textContent = 'Solving...';
  const answer = solveProblem(input.value);
  output.textContent = answer;
});
```

In React, you **describe what the screen should look like** based on your data, and React handles the DOM updates for you:

```jsx
// React — you describe the UI, React updates the DOM
function Solver() {
  const [answer, setAnswer] = useState(null);

  return (
    <div>
      <button onClick={() => setAnswer(solveProblem(input))}>
        Solve
      </button>
      <p>{answer}</p>
    </div>
  );
}
```

**The core idea:** In vanilla JS, you tell the browser *how* to update. In React, you tell it *what* to show — React figures out the *how*.

---

## JSX — HTML Inside JavaScript

JSX is what lets you write HTML-like code inside JavaScript files. It looks like HTML, but it's actually JavaScript under the hood.

### From `Solver.jsx` in this project:

```jsx
<h1 className="text-4xl font-bold">
  Let's Master Some Math!
</h1>
<p className="text-gray-600 text-lg">
  Enter any precalculus or calculus problem
</p>
```

### Key differences from regular HTML:

| HTML | JSX | Why |
|------|-----|-----|
| `class="..."` | `className="..."` | `class` is a reserved word in JS |
| `for="..."` | `htmlFor="..."` | `for` is a reserved word in JS |
| `onclick="..."` | `onClick={...}` | camelCase + JS function (not a string) |
| `style="color: red"` | `style={{ color: 'red' }}` | Object instead of string |

### Embedding JavaScript in JSX
Use curly braces `{}` to insert any JavaScript expression:

```jsx
// From ProblemInput.jsx
<p className="text-xs text-gray-500">
  {problem.length}/1000 characters     {/* ← JS expression inside JSX */}
</p>
```

Think of `{}` as an escape hatch from HTML back into JavaScript.

---

## Components — Reusable Building Blocks

A **component** is just a JavaScript function that returns JSX. It's like creating your own custom HTML element.

### From this project:

```jsx
// src/components/solver/GraphViewer.jsx

export default function GraphViewer({ functionData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Graph View</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Graph content here */}
      </CardContent>
    </Card>
  );
}
```

Then you use it like an HTML tag:

```jsx
// In Solver.jsx
<GraphViewer functionData={graphData} />
```

### How this project organizes components:

```
components/
├── solver/           ← Components specific to the solver feature
│   ├── ProblemInput.jsx
│   ├── SolutionDisplay.jsx
│   └── GraphViewer.jsx
├── ui/               ← Generic, reusable UI components
│   ├── button.jsx
│   ├── card.jsx
│   └── ...
└── ErrorBoundary.jsx ← App-wide error handler
```

**Think of components like functions:** They take input (props), do some work, and return output (JSX). They can be reused anywhere, just like calling a function multiple times.

---

## Props — Passing Data to Components

**Props** (short for "properties") are how you pass data from a parent component to a child. They're like function arguments.

### Real example from this project:

**Parent** (`Solver.jsx`) passes data to **child** (`ProblemInput`):

```jsx
// Solver.jsx (parent)
<ProblemInput
  problem={problem}           // passing the current problem text
  setProblem={setProblem}      // passing a function to update it
  topic={topic}                // passing the selected topic
  setTopic={setTopic}          // passing a function to update it
  onSolve={handleSolve}        // passing the solve function
  isLoading={isLoading}        // passing loading state
/>
```

**Child** (`ProblemInput.jsx`) receives and uses them:

```jsx
// ProblemInput.jsx (child)
export default function ProblemInput({ problem, setProblem, topic, setTopic, onSolve, isLoading }) {
  // Now you can use these values!
  return (
    <Textarea
      value={problem}                    // display the problem
      onChange={(e) => setProblem(e.target.value)}  // update when typed
    />
  );
}
```

### The vanilla JS equivalent:

```javascript
// This is conceptually similar to:
function createProblemInput(problem, setProblem, topic, setTopic, onSolve, isLoading) {
  // Build and return HTML elements using these arguments
}
```

### Key rules about props:
- Props flow **one direction only**: parent → child (never child → parent)
- Props are **read-only** — the child can't change them directly
- To "send data up" to the parent, the parent passes a **function** as a prop (like `setProblem`), and the child calls it

---

## State — Data That Changes

**State** is data that your component owns and can change. When state changes, React automatically re-renders the component to show the new data.

### From `Solver.jsx`:

```jsx
export default function Solver() {
  const [problem, setProblem] = useState("");        // starts as empty string
  const [topic, setTopic] = useState("");            // starts as empty string
  const [solution, setSolution] = useState(null);    // starts as null
  const [graphData, setGraphData] = useState(null);  // starts as null
  const [isLoading, setIsLoading] = useState(false); // starts as false
```

### How `useState` works:

```jsx
const [value, setValue] = useState(initialValue);
//      ↑        ↑                    ↑
//   current   function to         starting
//   value     update it            value
```

### When state changes, the UI updates automatically:

```jsx
// When isLoading changes from false to true:
{isLoading ? (
  <span>Solving...</span>        // ← This shows when isLoading is true
) : (
  <span>Solve Problem</span>     // ← This shows when isLoading is false
)}
```

### The vanilla JS equivalent:

```javascript
// In vanilla JS, you'd do this manually:
let isLoading = false;

function setIsLoading(newValue) {
  isLoading = newValue;
  // Manually update the DOM:
  button.textContent = isLoading ? 'Solving...' : 'Solve Problem';
}
```

In React, you don't need the manual DOM update — changing state with `setIsLoading(true)` triggers an automatic re-render, and React updates only what changed.

---

## useEffect — Doing Things at the Right Time

`useEffect` lets you run code at specific moments — when a component first appears, when specific data changes, or when a component is removed.

### From `DarkModeContext.jsx`:

```jsx
useEffect(() => {
  // This code runs every time isDarkMode changes

  // Save preference
  localStorage.setItem('darkMode', isDarkMode);

  // Update the page
  if (isDarkMode) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}, [isDarkMode]);    // ← dependency array: "run this when isDarkMode changes"
```

### From `usePageTitle.js`:

```jsx
useEffect(() => {
  // This runs when the title prop changes
  document.title = title ? `${title} | MasterMath by sparkinCreations™` : 'MasterMath by sparkinCreations™';
}, [title]);   // ← only re-run when title changes
```

### The dependency array explained:

```jsx
useEffect(() => { ... }, []);          // Empty array → runs ONCE when component first appears
useEffect(() => { ... }, [isDarkMode]); // Runs when isDarkMode changes
useEffect(() => { ... });              // No array → runs after EVERY render (rarely used)
```

### The vanilla JS equivalent:

```javascript
// useEffect with [] is like:
document.addEventListener('DOMContentLoaded', () => { ... });

// useEffect with [value] is like:
// Setting up a watcher that fires when a value changes
// (There's no clean vanilla JS equivalent — this is a React superpower)
```

---

## Event Handling — Responding to Users

In React, you attach event handlers directly in JSX using camelCase props.

### From `ProblemInput.jsx`:

```jsx
// Button click
<Button onClick={handleSolve}>
  Solve Problem
</Button>

// Text input change
<Textarea
  value={problem}
  onChange={handleProblemChange}
  onKeyDown={handleKeyDown}
/>
```

The handler functions are defined in the same component:

```jsx
const handleProblemChange = (e) => {
  setProblem(e.target.value);     // update state with what the user typed
  setValidationError(null);       // clear any previous error
};

const handleKeyDown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (problem.trim() && topic && !isLoading) {
      handleSolve();              // solve on Enter key
    }
  }
};
```

### Vanilla JS comparison:

```javascript
// Vanilla JS
button.addEventListener('click', handleSolve);
textarea.addEventListener('input', handleProblemChange);
textarea.addEventListener('keydown', handleKeyDown);

// React JSX (same thing, but declared inline)
<Button onClick={handleSolve} />
<Textarea onChange={handleProblemChange} onKeyDown={handleKeyDown} />
```

The difference: in vanilla JS you query the DOM to find elements, then attach listeners. In React, you attach them right where the element is defined.

---

## Conditional Rendering — Show/Hide Based on Data

React lets you show or hide parts of the UI based on your data. No need for `element.style.display = 'none'`.

### Pattern 1: Ternary operator (if/else)
From `SolutionDisplay.jsx`:

```jsx
{isLoading ? (
  <span>Solving...</span>
) : (
  <span>Solve Problem</span>
)}
```

### Pattern 2: Logical AND (show if true)
From `SolutionDisplay.jsx`:

```jsx
{solution.tips && solution.tips.length > 0 && (
  <div>
    <h3>Key Insights:</h3>
    {/* tips content */}
  </div>
)}
```

This reads as: "If solution.tips exists AND has items, show this div."

### Pattern 3: Early return
From `GraphViewer.jsx`:

```jsx
export default function GraphViewer({ functionData }) {
  if (!functionData || !functionData.points) {
    return (
      <Card>
        <p>Enter a function to see its graph!</p>    {/* placeholder */}
      </Card>
    );
  }

  return (
    <Card>
      {/* actual graph */}
    </Card>
  );
}
```

If there's no data, show a placeholder. Otherwise, show the graph. Simple as that.

### Pattern 4: Validation error display
From `ProblemInput.jsx`:

```jsx
{validationError && (
  <div className="bg-red-50 border border-red-200 rounded-lg">
    <p>{validationError}</p>
  </div>
)}
```

Only shows the error box when `validationError` has a value.

---

## Lists and Looping — Rendering Arrays

In vanilla JS, you'd loop through data and create elements with `document.createElement()`. In React, you use `.map()` to turn an array of data into an array of JSX.

### From `ProblemInput.jsx` — rendering example problems:

```jsx
{EXAMPLE_PROBLEMS.map((ex, idx) => (
  <button
    key={idx}                                  // ← React needs a unique "key" for each item
    onClick={() => loadExample(ex)}
  >
    <span>{ex.topic}:</span> <span>{ex.problem}</span>
  </button>
))}
```

### From `SolutionDisplay.jsx` — rendering solution steps:

```jsx
{solution.steps.map((step, idx) => (
  <motion.div
    key={idx}
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: idx * 0.1 }}          // each step animates in sequence
  >
    <div className="flex gap-3">
      <div>{idx + 1}</div>                     {/* step number */}
      <p>{step}</p>                            {/* step text */}
    </div>
  </motion.div>
))}
```

### From `Layout.jsx` — rendering navigation items:

```jsx
{navigationItems.map((item) => (
  <SidebarMenuItem key={item.title}>
    <Link to={item.url}>
      <item.icon />                            {/* dynamic component! */}
      <span>{item.title}</span>
    </Link>
  </SidebarMenuItem>
))}
```

### Why `key` matters:
React uses `key` to track which items changed, were added, or removed. Without it, React has to guess — with it, React can update efficiently. Always use a unique value (like an `id` or `idx`).

### Vanilla JS comparison:

```javascript
// Vanilla JS
const list = document.querySelector('#steps');
solution.steps.forEach((step, idx) => {
  const div = document.createElement('div');
  div.textContent = `${idx + 1}. ${step}`;
  list.appendChild(div);
});

// React — just return JSX from .map()
{solution.steps.map((step, idx) => (
  <div key={idx}>{idx + 1}. {step}</div>
))}
```

---

## Context — Sharing Data Across Components

Sometimes many components need access to the same data (like the current theme). Instead of passing props through every level, **Context** lets you share data directly with any component that needs it.

### The problem Context solves:

```
Without Context (prop drilling):
App → Layout → Header → DarkModeButton    (must pass isDarkMode through every level)
App → Layout → Content → Solver → Card    (must pass isDarkMode here too)

With Context:
DarkModeProvider wraps App
Any component calls useDarkMode() to get the value directly
```

### From `DarkModeContext.jsx` — creating the context:

```jsx
// Step 1: Create the context
const DarkModeContext = createContext();

// Step 2: Create a provider component that holds the state
export function DarkModeProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  // Step 3: Wrap children and provide the value
  return (
    <DarkModeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
}

// Step 4: Create a hook for easy access
export function useDarkMode() {
  return useContext(DarkModeContext);
}
```

### From `App.jsx` — wrapping the app:

```jsx
function App() {
  return (
    <DarkModeProvider>          {/* everything inside can access dark mode */}
      <Router>
        <Layout>
          <Routes>...</Routes>
        </Layout>
      </Router>
    </DarkModeProvider>
  );
}
```

### From `Layout.jsx` — using the context:

```jsx
export default function Layout({ children }) {
  const { isDarkMode, toggleDarkMode } = useDarkMode();   // ← grab the values

  return (
    <button onClick={toggleDarkMode}>
      {isDarkMode ? <Sun /> : <Moon />}
    </button>
  );
}
```

Any component anywhere in the tree can call `useDarkMode()` — no prop drilling needed.

---

## Custom Hooks — Reusable Logic

A **custom hook** is a function that starts with `use` and contains reusable logic. It's a way to extract common patterns so you don't repeat yourself.

### From `usePageTitle.js`:

```jsx
import { useEffect } from 'react';

export function usePageTitle(title) {
  useEffect(() => {
    const baseTitle = 'MasterMath by sparkinCreations™';
    document.title = title ? `${title} | ${baseTitle}` : baseTitle;
  }, [title]);
}
```

### How pages use it:

```jsx
// In Solver.jsx
export default function Solver() {
  usePageTitle("Solver - Step-by-Step Math Solutions");
  // ...
}

// In Progress.jsx
export default function Progress() {
  usePageTitle("My Progress");
  // ...
}
```

Every page calls `usePageTitle()` with its title, and the hook handles setting `document.title`. Without this hook, every page would need its own `useEffect` for the same logic.

### Think of hooks like utility functions:
- Regular function: `formatDate(date)` — reusable data logic
- Custom hook: `usePageTitle(title)` — reusable React logic (can use state, effects, etc.)

---

## React Router — Page Navigation Without Reloads

In a traditional website, clicking a link loads a whole new HTML page. React Router **fakes** this — it changes the URL and swaps components without a page reload, making the app feel instant.

### From `App.jsx` — defining routes:

```jsx
<Router>
  <Layout>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/solver" element={<Solver />} />
      <Route path="/progress" element={<Progress />} />
      <Route path="/usermanual" element={<UserManual />} />
      <Route path="/faq" element={<FAQ />} />
      {/* ... more routes */}
    </Routes>
  </Layout>
</Router>
```

This says: "When the URL is `/solver`, render the `Solver` component. When it's `/progress`, render `Progress`." And `Layout` always stays — only the content inside `<Routes>` changes.

### From `Layout.jsx` — navigating with `<Link>`:

```jsx
import { Link } from "react-router-dom";

// Instead of <a href="/solver">
<Link to="/solver">Solver</Link>
```

`<Link>` looks like a regular link but doesn't reload the page. It tells React Router to swap the content.

### From `Layout.jsx` — knowing the current page:

```jsx
import { useLocation } from "react-router-dom";

const location = useLocation();

// Highlight the active nav item
className={location.pathname === item.url
  ? 'bg-gradient-to-r from-blue-100 to-purple-100'   // active style
  : ''                                                  // normal style
}
```

`useLocation()` tells you the current URL so you can style the active page in the sidebar.

### The `createPageUrl` helper:

```jsx
// src/utils/index.js
export function createPageUrl(pageName) {
  return `/${pageName.toLowerCase()}`;
}

// Usage:
createPageUrl("Solver")       // → "/solver"
createPageUrl("UserManual")   // → "/usermanual"
createPageUrl("PrivacyPolicy") // → "/privacypolicy"
```

This keeps URLs consistent throughout the app.

---

## The Component Tree — How It All Fits Together

Here's how MasterMath's components nest inside each other:

```
main.jsx
  └── App                          ← Root component
       └── ErrorBoundary           ← Catches crashes
            └── DarkModeProvider   ← Theme state
                 └── ToastProvider ← Notifications
                      └── ConfirmProvider  ← Confirmation dialogs
                           └── Router      ← URL management
                                └── Layout ← Sidebar + Header + Footer
                                     └── Routes  ← Page switcher
                                          ├── Home
                                          ├── Solver
                                          │    ├── ProblemInput
                                          │    ├── SolutionDisplay
                                          │    └── GraphViewer
                                          ├── Progress
                                          ├── UserManual
                                          ├── FAQ
                                          ├── Feedback
                                          ├── PrivacyPolicy
                                          └── TermsOfService
```

**Providers** (DarkModeProvider, ToastProvider, etc.) are like invisible wrappers. They don't render visible UI — they just make data or functions available to everything inside them.

**Layout** is the only component that always shows. The page components swap in and out based on the URL.

---

## Common Patterns You'll See in This Codebase

### Pattern 1: Loading states

```jsx
const [isLoading, setIsLoading] = useState(false);

const handleSolve = async () => {
  setIsLoading(true);          // show spinner
  try {
    const result = await solveProblem(problem, topic);
    setSolution(result);       // show result
  } catch (error) {
    toast.error("Failed!");    // show error
  } finally {
    setIsLoading(false);       // hide spinner regardless
  }
};
```

### Pattern 2: Controlled inputs

```jsx
// The React way — component state controls the input value
const [problem, setProblem] = useState("");

<Textarea
  value={problem}                              // state → input
  onChange={(e) => setProblem(e.target.value)}  // input → state
/>
```

The input always reflects the state, and the state always reflects the input. They're in sync.

### Pattern 3: Lifting state up
When two sibling components need the same data, the shared state lives in their parent:

```jsx
// Solver.jsx owns the state
const [solution, setSolution] = useState(null);
const [graphData, setGraphData] = useState(null);

// Both children receive what they need
<ProblemInput onSolve={handleSolve} />           {/* triggers solving */}
<SolutionDisplay solution={solution} />           {/* shows the result */}
<GraphViewer functionData={graphData} />          {/* shows the graph */}
```

`Solver.jsx` is the "single source of truth" for the solution data. Both display components just receive and render it.

### Pattern 4: Destructuring props

```jsx
// Instead of:
function ProblemInput(props) {
  console.log(props.problem);
  console.log(props.topic);
}

// MasterMath uses destructuring:
function ProblemInput({ problem, setProblem, topic, setTopic, onSolve, isLoading }) {
  // Use them directly — cleaner and clearer
}
```

### Pattern 5: `children` prop
The `children` prop lets a component wrap other content, like a container:

```jsx
// Layout receives whatever is inside it as "children"
export default function Layout({ children }) {
  return (
    <div>
      <Sidebar />
      <Header />
      <main>{children}</main>    {/* ← the current page renders here */}
      <Footer />
    </div>
  );
}

// In App.jsx, the Routes are the "children"
<Layout>
  <Routes>...</Routes>           {/* ← this becomes {children} in Layout */}
</Layout>
```

---

## Glossary

| Term | What It Means |
|------|--------------|
| **Component** | A function that returns JSX (your own custom HTML element) |
| **JSX** | HTML-like syntax inside JavaScript files |
| **Props** | Data passed from parent to child component (like function arguments) |
| **State** | Data a component owns that can change (triggers re-render when updated) |
| **Hook** | A special function starting with `use` (useState, useEffect, useContext, etc.) |
| **useState** | Hook to create a piece of changeable data |
| **useEffect** | Hook to run code when something happens (mount, update, unmount) |
| **useContext** | Hook to read data from a Context provider |
| **Context** | A way to share data across many components without passing props through each level |
| **Provider** | A component that makes Context data available to its children |
| **Re-render** | When React re-calls your component function to get updated JSX |
| **Virtual DOM** | React's internal copy of the real DOM — it compares changes to update efficiently |
| **Client-side routing** | Changing pages without a full browser reload (React Router) |
| **Controlled input** | An input whose value is controlled by React state |
| **Prop drilling** | Passing props through many levels of components (Context solves this) |
| **Lifting state up** | Moving state to a common parent when siblings need to share data |
| **Destructuring** | `{ a, b } = obj` — extracting values from objects (used heavily with props) |

---

## Next Steps

Now that you understand the patterns, try these exercises with the MasterMath codebase:

1. **Read `Solver.jsx`** and trace the full solving flow from button click to solution display
2. **Read `DarkModeContext.jsx`** and follow how the theme state flows through the app
3. **Read `ProblemInput.jsx`** and identify all the React patterns (state, props, events, conditional rendering, lists)
4. **Try adding a new page** — create a component, add a route in `App.jsx`, and add a nav item in `Layout.jsx`

The best way to learn React is to read real code and make small changes. MasterMath is a great codebase for that — it's small enough to understand fully, but uses real-world patterns you'll see in any React project.

---

*Built with care by sparkinCreations™ — Software that respects users.*
