# 🚀 Vercel Deployment Checklist

## Pre-Deployment Verification

### ✅ Local Testing
- [ ] Test manufacturers API: `curl http://localhost:8000/api/manufacturers`
- [ ] Test catalog API: `curl http://localhost:8000/api/midnam_catalog`
- [ ] Verify frontend loads: Open `http://localhost:8000` in Chrome
- [ ] Test MIDI features (if device connected)
- [ ] Check hosted banner appears (temporarily set hostname to test)
- [ ] Verify download functionality works

### ✅ Required Files Present
- [ ] `vercel.json` - Vercel configuration
- [ ] `requirements.txt` - Python dependencies
- [ ] `.vercelignore` - Files to exclude
- [ ] `.gitignore` - Git exclusions
- [ ] `api/_utils.py` - Shared utilities
- [ ] `api/manufacturers.py` - Manufacturers endpoint
- [ ] `api/midnam_catalog.py` - Catalog endpoint
- [ ] `js/core/hosting.js` - Hosted mode detection
- [ ] `css/core.css` - Includes hosted banner styles
- [ ] `index.html` - Imports hosting module

### ✅ Code Quality
- [ ] No console errors in browser DevTools
- [ ] No Python errors when running server
- [ ] All imports are correct
- [ ] CORS headers properly configured

---

## Git & GitHub Setup

### 1. Initialize Git Repository (if not done)
```bash
cd /Users/mikejennings/dev/midnamaker
git init
```

### 2. Create `.gitignore`
Already created! ✅

### 3. Commit All Files
```bash
git add .
git commit -m "Initial commit - Midnamaker v1.0

Features:
- Browse 470+ MIDNAM files
- Edit patch names and device info
- Full Web MIDI support
- Download edited files
- DTD validation
- SysEx tool
- Hosted mode with read-only library"
```

### 4. Create GitHub Repository
1. Go to [github.com/new](https://github.com/new)
2. Repository name: `midnamaker`
3. Description: "MIDI Name Document Editor - Browse and edit 470+ MIDNAM files with full MIDI support"
4. Public or Private (your choice)
5. Do NOT initialize with README
6. Click "Create repository"

### 5. Link and Push
```bash
git remote add origin https://github.com/YOUR_USERNAME/midnamaker.git
git branch -M main
git push -u origin main
```

---

## Vercel Deployment

### Method 1: Vercel Website (Recommended)

#### 1. Sign Up/Login
- Go to [vercel.com](https://vercel.com)
- Sign up with GitHub account (easiest)

#### 2. Import Project
1. Click "New Project"
2. Import Git Repository → Select `midnamaker`
3. Configure Project:
   - **Framework Preset:** Other
   - **Root Directory:** ./
   - **Build Command:** (leave empty)
   - **Output Directory:** (leave empty)
4. Click "Deploy"

#### 3. Wait for Deployment
- Build takes ~2-3 minutes
- Watch the logs for any errors
- Get your URL: `https://midnamaker-xxx.vercel.app`

#### 4. Test Deployed Site
- [ ] Visit the URL
- [ ] Check hosted banner appears
- [ ] Browse manufacturers
- [ ] Load a device
- [ ] Test MIDI (requires HTTPS - Vercel provides this)
- [ ] Download a file

---

### Method 2: Vercel CLI

#### 1. Install Vercel CLI
```bash
npm install -g vercel
```

#### 2. Login
```bash
vercel login
```

#### 3. Deploy
```bash
cd /Users/mikejennings/dev/midnamaker
vercel
```

Follow prompts:
- Link to existing project? **No**
- Project name: **midnamaker**
- Directory: **./  (current directory)**
- Override settings? **No**

#### 4. Deploy to Production
```bash
vercel --prod
```

---

## Post-Deployment

### ✅ Verification Checklist
- [ ] Site loads without errors
- [ ] Hosted banner displays
- [ ] Manufacturers list loads
- [ ] Can select and view devices
- [ ] MIDI device selection works (requires device)
- [ ] SysEx tool appears
- [ ] Download button works
- [ ] No console errors in browser
- [ ] Mobile responsive (test on phone)

### ✅ Performance Check
- [ ] Page loads in < 3 seconds
- [ ] API responses < 1 second
- [ ] No 500 errors in logs

### ✅ Optional: Custom Domain
1. Vercel Dashboard → Project → Settings → Domains
2. Add your domain
3. Follow DNS instructions
4. HTTPS auto-configured

---

## Common Issues & Fixes

### Build Fails
**Problem:** Build fails with Python errors
**Solution:**
- Check `requirements.txt` has correct packages
- Check Python version (should be 3.9+)
- View build logs in Vercel dashboard

### API Returns 500
**Problem:** API endpoints return 500 errors
**Solution:**
- Check function logs in Vercel dashboard
- Verify file paths use `Path(__file__).parent`
- Check imports are correct
- Ensure `patchfiles/` directory is committed

### Files Not Found
**Problem:** Patchfiles or assets not loading
**Solution:**
- Check `.vercelignore` isn't excluding needed files
- Verify files are committed to git
- Check "Source Files" in Vercel dashboard

### MIDI Not Working
**Problem:** MIDI devices don't appear
**Solution:**
- MIDI requires HTTPS (Vercel provides this)
- Check browser console for permission errors
- Try in Chrome/Edge (best Web MIDI support)
- Can't work in iframes

### Hosted Banner Not Showing
**Problem:** Banner doesn't appear on hosted site
**Solution:**
- Check browser console for import errors
- Verify `hosting.js` is loaded
- Check CSS is present
- Clear browser cache

---

## Updating Deployment

### Auto-Deploy (Recommended)
Every push to `main` branch auto-deploys:
```bash
# Make changes
git add .
git commit -m "Update patchfiles"
git push

# Vercel automatically redeploys!
```

### Manual Deploy
```bash
vercel --prod
```

---

## Monitoring

### Vercel Dashboard
- Real-time analytics
- Function logs
- Error tracking
- Performance metrics
- Build history

### View Logs
```bash
# CLI
vercel logs

# Or in Vercel Dashboard → Project → Deployments → View Logs
```

---

## Environment Variables (If Needed)

If you need to add environment variables:

1. Vercel Dashboard → Project → Settings → Environment Variables
2. Add variables
3. Redeploy

---

## Rollback (If Needed)

### Via Dashboard
1. Vercel Dashboard → Project → Deployments
2. Find previous working deployment
3. Click "..." → "Promote to Production"

### Via CLI
```bash
vercel rollback
```

---

## Cost Monitoring

### Free Tier Limits
- ✅ Bandwidth: 100 GB/month
- ✅ Functions: 100 GB-hours/month
- ✅ Invocations: 1M/month

### Monitor Usage
- Vercel Dashboard → Project → Usage

**Expected:** Midnamaker should stay well within free tier!

---

## Support

### Resources
- [Vercel Docs](https://vercel.com/docs)
- [Vercel Community](https://github.com/vercel/vercel/discussions)
- [Web MIDI API Docs](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API)

### Get Help
```bash
vercel --help
vercel logs --help
```

---

## Success Criteria

Your deployment is successful when:
- ✅ Site loads at `https://midnamaker-xxx.vercel.app`
- ✅ Hosted banner appears at top
- ✅ Can browse all manufacturers
- ✅ Can view device details
- ✅ MIDI features work (with device connected)
- ✅ Download works
- ✅ No console errors
- ✅ Mobile responsive

---

## 🎉 You're Live!

Once deployed, share your URL:
- Social media
- Music production forums
- DAW user groups
- MIDI communities

**Midnamaker is now available to the world!** 🌍🎵


