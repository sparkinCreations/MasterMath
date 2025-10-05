# 🚀 Deployment Guide

This guide covers different ways to deploy MathMaster for public access.

## 🌐 Live Demo

**Official Demo:** [mathmaster.sparkincreations.com](https://mathmaster.sparkincreations.com) *(update with your actual URL)*

## ⚡ Quick Deploy Options

### 1. **Netlify** (Recommended - Free)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/sparkinCreations/MathMaster)

**Manual Netlify Deployment:**
1. Fork the repository
2. Connect your GitHub account to Netlify
3. Import the MathMaster repository
4. Build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Deploy!

### 2. **Vercel** (Free)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sparkinCreations/MathMaster)

**Manual Vercel Deployment:**
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in project directory
3. Follow prompts

### 3. **GitHub Pages**

1. Go to repository Settings
2. Navigate to Pages section
3. Source: GitHub Actions
4. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npm run build
        
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

## 🔧 Manual Deployment

### Prerequisites
- Node.js 18+
- Web server (Apache, Nginx, etc.)

### Build Steps
```bash
# Clone repository
git clone https://github.com/sparkinCreations/MathMaster.git
cd MathMaster

# Install dependencies
npm install

# Build for production
npm run build

# Files will be in 'dist' directory
# Upload dist/* to your web server
```

### Server Configuration

#### **Apache (.htaccess)**
```apache
# Handle client-side routing
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# Enable compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/plain
  AddOutputFilterByType DEFLATE text/html
  AddOutputFilterByType DEFLATE text/xml
  AddOutputFilterByType DEFLATE text/css
  AddOutputFilterByType DEFLATE application/xml
  AddOutputFilterByType DEFLATE application/xhtml+xml
  AddOutputFilterByType DEFLATE application/rss+xml
  AddOutputFilterByType DEFLATE application/javascript
  AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
  ExpiresActive on
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>
```

#### **Nginx**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/mathmaster/dist;
    index index.html;

    # Handle client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
}
```

## 🌍 Custom Domain Setup

### 1. **DNS Configuration**
Point your domain to your hosting provider:
- **A Record:** `@` → `your-server-ip`
- **CNAME:** `www` → `your-domain.com`

### 2. **SSL Certificate**
Most hosting providers offer free SSL certificates:
- **Netlify:** Automatic HTTPS
- **Vercel:** Automatic HTTPS  
- **GitHub Pages:** Automatic HTTPS
- **Manual:** Use Let's Encrypt

## 📊 Analytics & Monitoring

### Privacy-Friendly Analytics
Since MathMaster is privacy-focused, consider:
- **Simple Analytics** - GDPR compliant
- **Plausible** - Privacy-first analytics
- **Self-hosted Umami** - Open source analytics

### Example Integration
```html
<!-- Add to index.html head section -->
<script defer data-domain="yourdomain.com" src="https://plausible.io/js/script.js"></script>
```

## 🔄 Continuous Deployment

### GitHub Actions (Recommended)
```yaml
name: Build and Deploy

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3
        
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install and Build
        run: |
          npm ci
          npm run build
          
      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v1.2
        with:
          publish-dir: './dist'
          production-branch: main
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

## 🚨 Production Checklist

### Before Deploying:
- [ ] Test build locally: `npm run build && npm run preview`
- [ ] Check all math functions work correctly
- [ ] Verify responsive design on multiple devices
- [ ] Test dark/light mode switching
- [ ] Ensure all links work (Terms, Privacy, etc.)
- [ ] Verify export/import functionality

### After Deploying:
- [ ] Test on actual domain
- [ ] Check HTTPS is working
- [ ] Verify social media previews (Open Graph tags)
- [ ] Test performance with Lighthouse
- [ ] Monitor for any console errors

## 📈 Performance Optimization

### Build Optimizations
```json
// vite.config.js additions
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          math: ['algebrite', 'mathjs', 'mathsteps']
        }
      }
    }
  }
}
```

### CDN Integration
Consider using a CDN for faster global access:
- **Cloudflare** - Free tier available
- **AWS CloudFront** 
- **Netlify CDN** - Included with hosting

---

## 🤝 Need Help?

- 📧 **Email:** admin@sparkincreations.com
- 💬 **Issues:** [GitHub Issues](https://github.com/sparkinCreations/MathMaster/issues)
- 📚 **Documentation:** [README.md](README.md)

**Happy deploying! 🚀**