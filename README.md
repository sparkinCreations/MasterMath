# 📚 MasterMath

> **A privacy-focused educational math solver that helps students master precalculus and calculus concepts through step-by-step solutions.**

🌐 **Live at [mastermath.app](https://mastermath.app)**

[![Built with AI](https://img.shields.io/badge/Built%20with-AI%20Assistance-blue)](https://github.com/sparkinCreations/MasterMath)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18.3.1-blue)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4.5-purple)](https://vitejs.dev/)

![MasterMath Screenshot](./docs/screenshot.png)

## 🌟 Features

### 🧮 **Comprehensive Math Solver**
- **Derivatives & Differentiation** - Worked term-by-term, showing the rule used and the intermediate result for each term
- **Integrals & Integration** - Real per-term antiderivatives with the technique named (power rule, u-substitution, by parts)
- **Limits** - Symbolic strategy ladder (substitution → simplify → Taylor series → L'Hôpital), with answers independently cross-checked
- **Algebra** - Equation solving with exact roots (radicals and complex numbers included)
- **Trigonometry** - Special angles, degree/radian handling, and honest "Undefined" at vertical asymptotes
- **Functions & Graphing** - Visual function analysis
- **Arithmetic** - Order-of-operations walkthroughs

### 📊 **Visual Learning**
- **Interactive Graphs** - Visualize functions and solutions
- **Step-by-Step Explanations** - Understand the process, not just the answer
- **Common Mistakes Warnings** - Learn what to avoid
- **Educational Tips** - Contextual learning guidance

### 🔒 **Privacy-First Design**
- **100% Client-Side** - No data sent to servers, no AI
- **Works Offline** - Installable PWA; solve problems with no connection at all
- **Local Storage** - Your problems stay on your device
- **No Account Required** - Start solving immediately
- **Export Functionality** - Save your work locally (PDF, CSV, JSON, Markdown)

### 🎨 **Modern User Experience**
- **Dark/Light Mode** - Comfortable viewing in any environment
- **Settings & Solver Preferences** - Choose your angle unit (auto/degrees/radians) and result precision
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Progress Tracking** - Monitor your learning journey
- **Clean Interface** - Focus on learning, not distractions

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/sparkinCreations/MasterMath.git
cd MasterMath

# Install dependencies
npm install

# Start development server
npm run dev

# Run the automated test suite
npm test

# Build for production
npm run build
```

### Usage

1. **Enter a Math Problem** - Type any precalculus or calculus problem
2. **Select Topic** - Choose the appropriate mathematical category
3. **Get Step-by-Step Solution** - Review detailed explanations
4. **Visualize Results** - View graphs when applicable
5. **Learn & Verify** - Always double-check solutions independently

## 🏗️ Technology Stack

### **Frontend Framework**
- **React 18.3.1** - Modern UI library with hooks
- **Vite** - Fast build tool and development server
- **React Router** - Client-side routing

### **Math Libraries**
- **Algebrite** - Symbolic calculus and algebra
- **MathJS** - Expression parsing and evaluation
- **mathsteps** - Step-by-step algebraic solutions

### **Styling & UI**
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Modern component library
- **Lucide React** - Icon system
- **Framer Motion** - Animations

### **Charts & Visualization**
- **Recharts** - Interactive function graphs

### **Storage & Export**
- **IndexedDB** - Browser-based local storage
- **jsPDF** - PDF generation for exports

## 📖 How It Works

MasterMath uses **local JavaScript math libraries** (not AI) to solve problems:

1. **Math Parser** extracts expressions from natural language input
2. **Topic Router** directs problems to the appropriate solver
3. **Solver Engines** compute solutions using mathjs, algebrite, and mathsteps
4. **Solution Formatter** generates step-by-step explanations, tips, and graphs
5. **Local Storage** saves your history in the browser (IndexedDB)

All computations happen **entirely in your browser** - no data is sent to external servers.

The solvers are covered by an automated test suite (55 tests, `npm test`),
including a regression suite that pins every previously-fixed math bug —
from `tan(π/2)` floating-point artifacts to cancellation-prone limits —
so they can't silently return.

## 📖 Educational Philosophy

MasterMath is designed as a **learning companion**, not a homework shortcut:

### ✅ **Use For:**
- Understanding solution steps
- Verifying your work
- Learning problem-solving patterns
- Building mathematical intuition

### ⚠️ **Important:**
- Always verify solutions independently
- Use as a learning aid, not a replacement for practice
- Respect your institution's academic integrity policies

## 🗂️ Project Structure

```
MasterMath/
├── 📄 Configuration
│   ├── index.html              # Main entry point
│   ├── package.json            # Dependencies and scripts
│   ├── vite.config.js          # Vite build configuration
│   ├── tailwind.config.js      # Tailwind CSS configuration
│   └── postcss.config.js       # PostCSS configuration
│
├── 🎨 Source Code (src/)
│   ├── main.jsx                # React entry point
│   ├── App.jsx                 # Root component with providers & routes
│   ├── Layout.jsx              # Main layout with sidebar navigation
│   ├── index.css               # Global styles
│   │
│   ├── components/
│   │   ├── ErrorBoundary.jsx   # Error boundary component
│   │   ├── solver/             # Solver-specific components
│   │   │   ├── ProblemInput.jsx     # Problem input form
│   │   │   ├── SolutionDisplay.jsx  # Solution with steps & tips
│   │   │   └── GraphViewer.jsx      # Function graph visualization
│   │   └── ui/                 # shadcn/ui components
│   │       ├── button.jsx
│   │       ├── card.jsx
│   │       ├── sidebar.jsx
│   │       ├── toast.jsx
│   │       └── ...             # Other UI components
│   │
│   ├── pages/
│   │   ├── Home.jsx            # Landing page
│   │   ├── Solver.jsx          # Main problem solver interface
│   │   ├── Progress.jsx        # History & statistics
│   │   ├── Settings.jsx        # Theme, solver preferences, data & about
│   │   ├── UserManual.jsx      # Documentation
│   │   ├── FAQ.jsx             # Frequently asked questions
│   │   ├── Feedback.jsx        # User feedback form
│   │   ├── PrivacyPolicy.jsx   # Privacy policy
│   │   └── TermsOfService.jsx  # Terms of service
│   │
│   ├── lib/
│   │   ├── api.js              # Main API for solving & storage
│   │   ├── indexedDB.js        # IndexedDB wrapper
│   │   ├── mathParser.js       # Expression parsing utilities
│   │   ├── mathstepsUtils.js   # mathsteps output formatting
│   │   ├── settings.js         # User preferences (localStorage-backed)
│   │   ├── exportUtils.js      # Export to PDF/CSV/JSON/Markdown
│   │   ├── validation.js       # Input validation utilities
│   │   ├── utils.js            # General utilities
│   │   └── solvers/            # Topic-specific math solvers
│   │       ├── solverUtils.js       # Shared helpers (beautify, terms, sampling)
│   │       ├── algebraSolver.js
│   │       ├── derivativesSolver.js
│   │       ├── integralsSolver.js
│   │       ├── arithmeticSolver.js
│   │       └── otherSolvers.js      # Limits, trig, functions
│   │
│   ├── contexts/
│   │   └── DarkModeContext.jsx # Dark mode state management
│   │
│   ├── hooks/
│   │   ├── usePageTitle.js     # Custom hook for page titles
│   │   └── useServiceWorker.js # PWA update detection & banner flow
│   │
│   ├── entities/
│   │   └── ProblemHistory.json # IndexedDB schema definition
│   │
│   └── utils/
│       └── index.js            # Utility functions
│
├── 🧪 Tests (tests/)
│   ├── solvers.test.js         # Solver behavior across all topics
│   ├── regressions.test.js     # Pinned past bugs (never let them return)
│   ├── settings.test.js        # Preferences store & solver wiring
│   ├── mathParser.test.js      # Input parsing
│   ├── mathstepsUtils.test.js  # Step formatting
│   ├── solverUtils.test.js     # Shared helpers
│   └── validation.test.js      # Input validation
│
├── 📁 Public Assets (public/)
│   ├── favicon.svg             # App icon
│   ├── favicon.png             # PNG favicon
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Offline-first service worker
│   ├── robots.txt              # Search engine directives
│   ├── sitemap.xml             # Site map
│   ├── og-image.jpg            # Open Graph image
│   └── twitter-image.jpg       # Twitter card image
│
└── 📚 Documentation
    ├── README.md               # This file
    ├── CLAUDE.md               # Claude Code project instructions
    ├── CONTRIBUTING.md         # Contribution guidelines
    ├── CHANGELOG.md            # Version history
    ├── DEPLOYMENT.md           # Deployment instructions
    ├── SECURITY.md             # Security policy
    ├── LICENSE                 # MIT license
    └── docs/
        ├── HOW_THE_APP_WORKS.md     # Architecture & data flow guide
        ├── FILE_STRUCTURE.md        # File organization docs
        ├── REACT_GUIDE.md           # React concepts for this app
        └── future-work/ROADMAP.md   # Prioritized future improvements
```

## 🤝 Contributing

We welcome contributions from the community! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### **Ways to Contribute:**
- 🐛 **Bug Reports** - Find and report issues
- ✨ **Feature Requests** - Suggest new functionality
- 📝 **Documentation** - Improve guides and examples
- 🧮 **Math Solvers** - Add new mathematical topics
- 🎨 **UI/UX** - Enhance user experience
- 🧪 **Testing** - Add test coverage

### **Development Setup:**
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Commit with clear messages: `git commit -m 'Add amazing feature'`
5. Push to your fork: `git push origin feature/amazing-feature`
6. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏢 About sparkinCreations™

MasterMath is developed by [sparkinCreations™](https://sparkincreations.com), committed to creating educational tools that promote learning and understanding.

### **Contact:**
- 🌐 **Website:** [sparkincreations.com](https://sparkincreations.com)
- 📧 **Email:** admin@sparkincreations.com
- 💬 **Issues:** [GitHub Issues](https://github.com/sparkinCreations/MasterMath/issues)

## 🙏 Acknowledgments

- **Math Libraries** - Algebrite, MathJS, and mathsteps communities
- **UI Framework** - React and Vite teams
- **AI Assistance** - Claude (Anthropic) for development support
- **Open Source** - All the amazing libraries that make this possible

## ⚠️ Important Notice

**MasterMath is an educational tool designed to help students learn mathematical concepts. All computations are performed using JavaScript math libraries (not AI). Always verify solutions independently and respect your institution's academic integrity policies.**

---

**Made with ❤️ by sparkinCreations™ • Powered by ⚛️ React**

*Master math with confidence!*
