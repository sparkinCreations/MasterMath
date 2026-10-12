# Security Policy

## Supported Versions

We actively maintain and provide security updates for the following versions of MasterMath:

MasterMath is a web app that updates itself: every visitor runs the latest
release, and the in-app update banner moves an open tab onto it. Only the
latest release receives fixes.

| Version        | Supported              |
| -------------- | ---------------------- |
| Latest release | ✅ Fully supported      |
| Anything older | ❌ Reload to update     |

## Security Considerations

### Client-Side Application
MasterMath is a **client-side only** application that:
- Runs entirely in the user's browser
- Does not transmit data to external servers — the one exception is the
  Feedback form, which sends your message to Web3Forms only when you submit it
- Stores data locally using browser storage APIs
- Does not require user accounts or authentication

### Privacy Protection
- **No data collection** - All calculations happen locally
- **No tracking** - No analytics or user behavior monitoring
- **No cookies** - Except for essential functionality (dark mode preferences)
- **No external API calls** - Self-contained, apart from a submitted Feedback form

## Reporting Security Vulnerabilities

If you discover a security vulnerability in MasterMath, please help us maintain a secure environment for all users.

### Reporting Process

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please email us directly at:
📧 **security@sparkincreations.com**

### What to Include

When reporting a security vulnerability, please include:

1. **Description** - Clear description of the vulnerability
2. **Steps to Reproduce** - Detailed steps to reproduce the issue
3. **Impact Assessment** - Potential impact and affected systems
4. **Proof of Concept** - If possible, include a proof of concept
5. **Suggested Fix** - If you have ideas for remediation

### Example Report Format

```
Subject: [SECURITY] Brief description of vulnerability

## Vulnerability Description
[Detailed description of the security issue]

## Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens - security concern]

## Impact
[Potential security impact]

## Environment
- Browser: [e.g., Chrome 118]
- OS: [e.g., macOS 14]
- MasterMath Version: [e.g., 1.0.0]

## Additional Information
[Any other relevant details]
```

### Response Timeline

We are committed to responding to security reports promptly:

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 5 business days
- **Status Updates**: Every 7 days during investigation
- **Resolution**: Varies based on complexity and severity

### Disclosure Policy

We follow responsible disclosure practices:

1. **Investigate** - We investigate and validate the reported vulnerability
2. **Fix** - We develop and test a fix for the vulnerability
3. **Release** - We release the security update
4. **Disclose** - We publicly disclose the vulnerability details after users have had time to update

### Severity Guidelines

We use the following guidelines to assess vulnerability severity:

#### **Critical (CVSS 9.0-10.0)**
- Remote code execution
- Unauthorized access to sensitive data
- System compromise

#### **High (CVSS 7.0-8.9)**
- Privilege escalation
- Data exposure
- Significant application functionality bypass

#### **Medium (CVSS 4.0-6.9)**
- Limited data exposure
- Denial of service
- Information disclosure

#### **Low (CVSS 0.1-3.9)**
- Minor information disclosure
- Low-impact functionality issues

## Security Best Practices

### For Users

1. **Keep Updated** - Always use the latest version of MasterMath
2. **Verify Sources** - Only download from official sources
3. **Browser Security** - Keep your browser updated
4. **Local Storage** - Be aware that data is stored locally in your browser

### For Contributors

1. **Input Validation** - Always validate and sanitize user inputs
2. **XSS Prevention** - Prevent cross-site scripting vulnerabilities
3. **Dependency Security** - Keep dependencies updated and secure
4. **Code Review** - All code changes should be reviewed for security implications

## Common Security Considerations

### Mathematical Input Processing
- All mathematical expressions are processed using established libraries
- Input sanitization prevents code injection
- Error handling prevents information disclosure

### Response Headers
Netlify serves the headers in `public/_headers` with every response: a
Content-Security-Policy (scripts from the app's own origin only — no `eval`, no
inline script except the boot watchdog, allowed by its hash; framing denied;
network requests limited to the app and the Feedback endpoint), plus
`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` and
`Permissions-Policy`. `vite preview` serves the same file, so the browser smoke
test runs under the production policy, and `tests/securityHeaders.test.js`
keeps the watchdog's hash in step with `index.html`.

### Browser Storage
- Local storage is used for user preferences and problem history
- No sensitive information should be stored
- Data remains on the user's device only

### Third-Party Dependencies
- Regular dependency updates for security patches
- `npm audit --omit=dev` runs in CI on every push and fails on a high or
  critical advisory in a shipped dependency
- Minimal dependency footprint to reduce attack surface

## Contact Information

For security-related inquiries:

- 🔒 **Security Email**: security@sparkincreations.com
- 🌐 **General Contact**: admin@sparkincreations.com
- 💻 **Website**: [sparkincreations.com](https://sparkincreations.com)

---

**Thank you for helping keep MasterMath secure for all users!**

*Security is a shared responsibility - we appreciate your vigilance and responsible disclosure.*