# Contributing to MathMaster

Thank you for your interest in contributing to MathMaster! We welcome contributions from developers, educators, and students who want to help improve this educational math tool.

## 🎯 Project Goals

- **Educational First** - Promote learning and understanding over quick answers
- **Privacy Focused** - Keep all data client-side and respect user privacy
- **Accessible** - Ensure the tool works for all students
- **Accurate** - Provide reliable mathematical solutions with proper disclaimers
- **Open Source** - Build a community around mathematical education

## 📋 Types of Contributions

### 🐛 Bug Reports
**Found an issue?** Help us improve by reporting:
- Incorrect mathematical solutions
- UI/UX problems
- Browser compatibility issues
- Performance problems

**Bug Report Template:**
```markdown
## Bug Description
Brief description of the issue

## Steps to Reproduce
1. Go to...
2. Enter problem...
3. Click...
4. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- Browser: [e.g., Chrome 118]
- OS: [e.g., macOS 14]
- MathMaster Version: [e.g., 1.0.0]

## Mathematical Problem (if applicable)
- Problem entered: [e.g., "x^2 + 2x = 0"]
- Topic selected: [e.g., "Algebra"]
- Incorrect result: [description]
```

### ✨ Feature Requests
**Have an idea?** We'd love to hear it:
- New mathematical topics or functions
- UI improvements
- Educational features
- Accessibility enhancements

**Feature Request Template:**
```markdown
## Feature Description
Clear description of the proposed feature

## Educational Value
How would this help students learn?

## Implementation Ideas
Any thoughts on how it could work?

## Priority
- [ ] Nice to have
- [ ] Important
- [ ] Critical for learning
```

### 🧮 Mathematical Improvements
- Add new solver algorithms
- Improve step-by-step explanations
- Enhance mathematical accuracy
- Add more educational tips

### 🎨 UI/UX Enhancements
- Improve accessibility
- Better mobile experience
- Enhanced visualizations
- Cleaner interfaces

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Git
- Basic understanding of React
- Mathematical knowledge (for math-related contributions)

### Development Setup

1. **Fork the Repository**
   ```bash
   # Click "Fork" on GitHub, then clone your fork
   git clone https://github.com/yourusername/mathmaster.git
   cd mathmaster
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Code Style Guidelines

#### **React Components**
```jsx
// Use functional components with hooks
import React, { useState } from 'react';

export default function ComponentName({ prop1, prop2 }) {
  const [state, setState] = useState(initialValue);
  
  return (
    <div className="tailwind-classes">
      {/* Component content */}
    </div>
  );
}
```

#### **Math Solvers**
```javascript
// Follow this pattern for new solvers
export function solveTopic(expression) {
  try {
    // Parse and validate input
    const parsedExpression = parseExpression(expression);
    
    // Solve step by step
    const steps = generateSteps(parsedExpression);
    const answer = calculateAnswer(parsedExpression);
    
    // Generate educational content
    const tips = generateTips(expression);
    const commonMistakes = generateMistakes(expression);
    
    return {
      steps,
      answer,
      tips,
      common_mistakes: commonMistakes,
      graph: generateGraph(expression) // if applicable
    };
  } catch (error) {
    return fallbackResponse(expression, error);
  }
}
```

#### **File Naming**
- Components: `PascalCase.jsx`
- Utilities: `camelCase.js`
- Constants: `UPPER_SNAKE_CASE`

#### **CSS Classes**
- Use Tailwind CSS utilities
- Follow responsive design patterns
- Include dark mode support: `dark:bg-gray-800`

### Testing Your Changes

1. **Manual Testing**
   - Test core functionality
   - Try various math problems
   - Check responsive design
   - Verify dark mode

2. **Browser Testing**
   - Chrome/Chromium
   - Firefox
   - Safari (if on macOS)
   - Mobile browsers

3. **Mathematical Accuracy**
   - Verify solutions with external tools
   - Test edge cases
   - Check step-by-step logic

## 📝 Pull Request Process

### Before Submitting
- [ ] Test your changes thoroughly
- [ ] Update documentation if needed
- [ ] Follow code style guidelines
- [ ] Check for console errors
- [ ] Verify responsive design

### Pull Request Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement

## Mathematical Changes (if applicable)
- [ ] Added new solver
- [ ] Fixed calculation error
- [ ] Improved explanations
- [ ] Enhanced accuracy

## Testing
- [ ] Tested manually
- [ ] Verified mathematical accuracy
- [ ] Checked responsive design
- [ ] Tested dark mode

## Screenshots (if applicable)
<!-- Add screenshots for UI changes -->
```

### Review Process
1. **Automated Checks** - Basic linting and build verification
2. **Code Review** - Maintainer review for quality and consistency
3. **Mathematical Review** - Accuracy verification for math changes
4. **Testing** - Final verification before merge

## 🧮 Mathematical Accuracy Standards

### **Verification Requirements**
- Cross-check solutions with established mathematical tools
- Include proper error handling for edge cases
- Provide clear step-by-step explanations
- Add appropriate disclaimers for limitations

### **Educational Standards**
- Explanations should be clear for target audience
- Include common mistakes and tips
- Follow standard mathematical notation
- Consider different learning styles

## 🏢 Code of Conduct

### **Our Standards**
- **Respectful** - Be kind and constructive
- **Educational** - Focus on learning and improvement
- **Collaborative** - Work together toward common goals
- **Inclusive** - Welcome contributors of all backgrounds

### **Unacceptable Behavior**
- Harassment or discrimination
- Unhelpful or destructive criticism
- Sharing solutions that encourage academic dishonesty
- Spam or off-topic contributions

## 📞 Getting Help

### **Questions?**
- 📧 **Email:** admin@sparkincreations.com
- 💬 **Issues:** [GitHub Issues](https://github.com/yourusername/mathmaster/issues)
- 📚 **Documentation:** Check existing docs first

### **Discussion Topics**
- Implementation approaches
- Mathematical accuracy questions
- Educational methodology
- Technical architecture

## 🎓 Educational Guidelines

### **Academic Integrity**
- Promote understanding over quick answers
- Encourage verification of solutions
- Respect institutional policies
- Build learning habits

### **Solution Quality**
- Step-by-step explanations
- Clear mathematical notation
- Educational tips and warnings
- Appropriate difficulty level

## 🙏 Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes for significant contributions
- Special thanks for educational improvements

---

**Thank you for helping make math education more accessible and effective! 🚀**

*Every contribution, no matter how small, helps students learn and succeed.*