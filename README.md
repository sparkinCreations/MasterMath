# 📚 MasterMath

> **A privacy-focused, AI-powered educational math solver that helps students master precalculus and calculus concepts through step-by-step solutions.**

[![Built with AI](https://img.shields.io/badge/Built%20with-AI%20Assistance-blue)](https://github.com/sparkinCreations/MasterMath)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18.3.1-blue)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4.5-purple)](https://vitejs.dev/)

![MasterMath Screenshot](./docs/screenshot.png)

## 🌟 Features

### 🧮 **Comprehensive Math Solver**
- **Derivatives & Differentiation** - Step-by-step calculus solutions
- **Integrals & Integration** - Detailed integration processes  
- **Limits** - Limit calculations with explanations
- **Algebra** - Equation solving and simplification
- **Trigonometry** - Trig function solutions
- **Functions & Graphing** - Visual function analysis
- **Arithmetic** - Basic mathematical operations

### 📊 **Visual Learning**
- **Interactive Graphs** - Visualize functions and solutions
- **Step-by-Step Explanations** - Understand the process, not just the answer
- **Common Mistakes Warnings** - Learn what to avoid
- **Educational Tips** - Contextual learning guidance

### 🔒 **Privacy-First Design**
- **100% Client-Side** - No data sent to servers
- **Local Storage** - Your problems stay on your device
- **No Account Required** - Start solving immediately
- **Export Functionality** - Save your work locally

### 🎨 **Modern User Experience**
- **Dark/Light Mode** - Comfortable viewing in any environment
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
- **Algebrite** - Symbolic math computations
- **MathJS** - Math expression parser and evaluator
- **mathsteps** - Step-by-step algebra solutions

### **Styling & UI**
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Beautiful icons
- **Custom Components** - Reusable UI elements
- **Framer Motion** - Smooth animations

### **Charts & Visualization**
- **Recharts** - Interactive graph generation
- **Custom Graphing** - Mathematical function plotting

## 🤖 AI-Assisted Development

**This project demonstrates modern AI-assisted development practices:**

- **Initial Prototype** - Built with AI assistance for rapid development
- **Human Oversight** - Curated and refined for quality and educational value
- **Iterative Improvement** - Continuous enhancement with AI collaboration
- **Educational Focus** - AI helped implement learning-first design principles

**Key AI Contributions:**
- Mathematical solver implementations
- User interface design and components
- Educational explanations and tips
- Error handling and edge cases

**Human Contributions:**
- Project vision and educational philosophy
- Privacy-first architecture decisions
- User experience design
- Quality assurance and testing

## 📖 Educational Philosophy

MasterMath is designed as a **learning companion**, not a homework shortcut:

### ✅ **Encourage:**
- Understanding mathematical concepts
- Step-by-step problem solving
- Independent verification of results
- Building mathematical intuition

### ⚠️ **Important Disclaimers:**
- **Always verify solutions** independently
- Solutions may contain errors - use as learning aid only
- Respect your institution's academic integrity policies
- Cross-reference with textbooks and instructors

## 🗂️ Project Structure

```
mastermath/
├── 📄 Core Application
│   ├── index.html              # Main entry point
│   ├── package.json           # Dependencies and scripts
│   └── vite.config.js         # Build configuration
│
├── 🎨 Source Code
│   ├── src/
│   │   ├── App.jsx            # Main application component
│   │   ├── Layout.jsx         # App layout and navigation
│   │   ├── main.jsx          # React entry point
│   │   │
│   │   ├── components/        # Reusable UI components
│   │   │   ├── solver/        # Math solver components
│   │   │   └── ui/           # Base UI components
│   │   │
│   │   ├── pages/            # Application pages
│   │   │   ├── Solver.jsx    # Main solver interface
│   │   │   ├── Progress.jsx  # Progress tracking
│   │   │   └── UserManual.jsx # Help documentation
│   │   │
│   │   ├── lib/              # Core logic and utilities
│   │   │   ├── api.js        # Math problem solving API
│   │   │   ├── mathParser.js # Expression parsing
│   │   │   └── solvers/      # Topic-specific solvers
│   │   │
│   │   └── contexts/         # React context providers
│   │       └── DarkModeContext.jsx
│   │
├── 📁 Assets
│   └── public/
│       └── favicon.svg       # App icon
│
└── 📚 Documentation
    ├── README.md             # This file
    ├── LICENSE              # MIT license
    └── CONTRIBUTING.md      # Contribution guidelines
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

**MasterMath is an educational tool designed to help students learn mathematical concepts. Always verify solutions independently and respect your institution's academic integrity policies. Solutions may contain errors and should not be used as the sole source of mathematical truth.**

---

**Made with ❤️ for education • Built with 🤖 AI assistance • Powered by ⚛️ React**

*Master math with confidence!*