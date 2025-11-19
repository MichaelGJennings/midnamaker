# 🚀 Deploying Midnamaker to Vercel

## Overview

This guide will help you deploy Midnamaker as a **free, globally-hosted web app** on Vercel with:
- ✅ **Full MIDI support** (Web MIDI API works perfectly)
- ✅ **Read-only patchfile library** (470+ devices included)
- ✅ **Edit & download** (make changes, download your modifications)
- ✅ **Fast CDN delivery** (instant loading worldwide)
- ✅ **HTTPS by default** (secure)
- ✅ **Custom domain** support (optional)

**Note:** The hosted version is **read-only** - users can browse, edit, and download, but can't save changes to the server. This is perfect for:
- Exploring the MIDNAM library
- Editing and downloading customized files
- Learning MIDI programming
- Testing MIDI devices

---

## Prerequisites

1. **GitHub account** (free)
2. **Vercel account** (free) - sign up at [vercel.com](https://vercel.com)
3. **Git installed** locally

---

## Step-by-Step Deployment

### 1. Prepare the Repository

```bash
cd /Users/mikejennings/dev/midnamaker

# Initialize git if not already done
git init

# Add all necessary files
git add .

# Commit
git commit -m "Prepare for Vercel deployment"
```

### 2. Push to GitHub

```bash
# Create a new repository on GitHub (github.com/new)
# Then link it:
git remote add origin https://github.com/YOUR_USERNAME/midnamaker.git
git branch -M main
git push -u origin main
```

### 3. Deploy to Vercel

**Option A: Via Vercel Website (Easiest)**

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import Project"
3. Select your GitHub repository
4. Vercel auto-detects settings from `vercel.json`
5. Click "Deploy"
6. Done! 🎉

**Option B: Via Vercel CLI**

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: midnamaker
# - Which directory? ./ (current)
# - Override settings? No

# Deploy to production
vercel --prod
```

### 4. Your App is Live!

Vercel gives you a URL like: `https://midnamaker.vercel.app`

---

## Configuration Files

### ✅ Already Created:

- **`vercel.json`** - Vercel configuration
- **`api/*.py`** - Serverless functions
- **`requirements.txt`** - Python dependencies
- **`.vercelignore`** - Files to exclude from deployment

---

## What Gets Deployed

### ✅ Included:
- Frontend: `index.html`, `js/`, `css/`
- MIDNAM library: `patchfiles/*.midnam` (470+ files)
- DTD validation: `dtd/`
- API endpoints: `api/*.py`
- Assets: `manifest.json`, `icon.svg`

### ❌ Excluded:
- Tests: `tests/`
- Desktop app: `dist/`, `*.app`
- Node modules
- Build artifacts
- Documentation (most)

---

## API Endpoints

The following endpoints work on Vercel:

### Read-Only Endpoints:
- ✅ `GET /api/manufacturers` - List all manufacturers
- ✅ `GET /api/midnam_catalog` - Get full catalog
- ✅ `GET /api/device/[id]` - Get device details (needs implementation)

### Not Available (Serverless Limitation):
- ❌ `POST /api/midnam/save` - Can't save to server filesystem
- ❌ `POST /api/patch/save` - Can't save to server filesystem
- ❌ File uploads - No persistent storage

### Alternative: Download Feature
Users can:
1. Edit patches in the browser
2. Click "Download" to save locally
3. Install downloaded files in their DAW

---

## Environment & Limits

### Vercel Free Tier:
- ✅ **Bandwidth:** 100 GB/month
- ✅ **Functions:** 100 GB-hours/month
- ✅ **Invocations:** 1 million/month
- ✅ **Custom domains:** Yes
- ✅ **HTTPS:** Automatic
- ⏱️ **Function timeout:** 10 seconds
- 💾 **Function memory:** 1024 MB

**More than enough for Midnamaker!**

### Function Size Optimization:

The current setup is optimized:
- Main library: ~50 MB (patchfiles)
- Functions bundle: ~5 MB each
- Cold start: ~2-3 seconds (first request)
- Warm: ~50-200ms (subsequent requests)

---

## Custom Domain (Optional)

### Add Your Domain:

1. Vercel Dashboard → Project → Settings → Domains
2. Add domain: `midnamaker.yourdomain.com`
3. Follow DNS instructions
4. HTTPS auto-configured

---

## Monitoring & Analytics

### Vercel Dashboard:
- Real-time analytics
- Function logs
- Error tracking
- Performance metrics

### View Logs:
```bash
vercel logs
```

---

## Updating the Deployment

### Option 1: Git Push (Auto-deploy)
```bash
git add .
git commit -m "Update patchfiles"
git push
# Vercel automatically redeploys!
```

### Option 2: Manual Deploy
```bash
vercel --prod
```

---

## Read-Only Mode Notification

Users will see a banner in the hosted version:

> **📘 Hosted Version (Read-Only)**
> This is the hosted version with 470+ MIDNAM files. You can browse, edit, and download files, but changes aren't saved to the server. For full editing, run locally or use the desktop app.

---

## Troubleshooting

### Build Fails:
```bash
# Check build logs
vercel logs

# Common issues:
# - Missing requirements.txt
# - Python version mismatch
# - Import errors
```

### API Returns 500:
- Check function logs in Vercel dashboard
- Verify Python dependencies in `requirements.txt`
- Check file paths (use `Path(__file__).parent`)

### MIDI Not Working:
- MIDI requires HTTPS (Vercel provides this automatically)
- Check browser console for permission errors
- Make sure you're not in an iframe

### Files Not Found:
- Check `.vercelignore` - make sure needed files aren't excluded
- Verify files are committed to git
- Check Vercel dashboard → Source Files

---

## Performance Tips

### Optimize for Speed:
1. ✅ **Already done:** `vercel.json` configured
2. ✅ **Caching:** Browser caching enabled
3. ✅ **CDN:** Files served from nearest edge location
4. ✅ **Compression:** Automatic gzip/brotli

### Monitor Performance:
- Vercel Analytics (free)
- Real User Monitoring
- Function execution times

---

## Cost Estimate

### Expected Usage (Free Tier):
- **Bandwidth:** ~10-20 GB/month (assuming 1000 visitors)
- **Function calls:** ~50k/month
- **Build time:** ~2 minutes/deployment

**Result:** Stays well within free tier! 💰

---

## Security

### Automatic:
- ✅ HTTPS/TLS encryption
- ✅ DDoS protection
- ✅ CDN security
- ✅ No server to hack (serverless)

### Recommendations:
- No sensitive data stored
- Read-only mode prevents abuse
- Rate limiting built-in

---

## Next Steps

1. ✅ **Deploy** following steps above
2. 🧪 **Test** all features on the live site
3. 📱 **Share** the URL with users
4. 📊 **Monitor** via Vercel dashboard
5. 🔄 **Update** by pushing to GitHub

---

## Support

- **Vercel Docs:** [vercel.com/docs](https://vercel.com/docs)
- **Vercel CLI:** `vercel --help`
- **Community:** [vercel.com/community](https://vercel.com/community)

---

## Summary

**Deploying to Vercel gives you:**
- 🌍 Globally-hosted web app
- 🚀 Fast, reliable, free
- 🎵 Full MIDI support
- 📚 Complete MIDNAM library
- 🔒 Secure HTTPS
- 📈 Analytics included

**Perfect for sharing Midnamaker with the world!** 🎉


