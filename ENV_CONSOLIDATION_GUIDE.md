# Frontend Environment Configuration - Simplified Approach

## 🎯 Executive Summary

**Answer: YES - Delete the environment-specific `.env` files and use a single `.env.example` template.**

The frontend can use **ONE `.env.example` file** + **CDP-injected environment variables**. The application config is now smart enough to compute environment-specific values automatically.

---

## ✅ What Changed

### Before (Complex - Multiple Files)

```
.env.dev       →  BACKEND_URL=https://...dev..., S3_BUCKET=dev-...
.env.test      →  BACKEND_URL=https://...test..., S3_BUCKET=test-...
.env.perf-test →  BACKEND_URL=https://...perf..., S3_BUCKET=perf-...
.env.prod      →  BACKEND_URL=https://...prod..., S3_BUCKET=prod-...
```

❌ Problems: Duplication, maintenance overhead, wrong file risk

### After (Simple - Auto-Computed)

```
.env.example   →  Template with all variables documented
CDP injects    →  ENVIRONMENT=dev
Config.js      →  Auto-computes BACKEND_URL, S3_BUCKET based on ENVIRONMENT
```

✅ Benefits: Single source of truth, auto-computed, less error-prone

---

## 🔧 Configuration Strategy

### 1. Smart Config File (`src/config/config.js`)

The config file now has helper functions that auto-compute URLs based on `ENVIRONMENT`:

```javascript
// Auto-detect CDP environment
const cdpEnvironment = process.env.ENVIRONMENT || 'local'
const isLocal = cdpEnvironment === 'local' || isDevelopment

// Smart URL generation
const getBackendUrl = () => {
  if (isLocal) return 'http://localhost:3001'
  return `https://content-reviewer-backend.${cdpEnvironment}.cdp-int.defra.cloud`
}

// Smart S3 bucket selection
const getS3Bucket = () => {
  if (isLocal) return 'dev-service-optimisation-c63f2'
  const bucketMap = {
    dev: 'dev-service-optimisation-c63f2',
    test: 'test-service-optimisation-bucket',
    'perf-test': 'perf-test-service-optimisation-bucket',
    prod: 'prod-service-optimisation-bucket'
  }
  return (
    bucketMap[cdpEnvironment] || `${cdpEnvironment}-service-optimisation-bucket`
  )
}

// Config uses smart defaults
export const config = convict({
  backendUrl: {
    default: getBackendUrl(), // ✅ Auto-computed!
    env: 'BACKEND_URL' // Can still override
  },
  cdpUploader: {
    s3Bucket: {
      default: getS3Bucket(), // ✅ Auto-computed!
      env: 'CDP_UPLOADER_S3_BUCKET'
    }
  }
})
```

### 2. What CDP Provides Automatically

```bash
# CDP Platform auto-injects these:
SERVICE_VERSION=abc123def456    # Git commit hash
ENVIRONMENT=dev                 # Or test, perf-test, prod
NODE_ENV=production            # Always production in CDP

# CDP Secrets Manager provides:
SESSION_COOKIE_PASSWORD=xxxxx   # From secrets vault
REDIS_PASSWORD=xxxxx           # If using managed Redis
```

### 3. What You Configure Once in CDP Portal

For each environment (dev, test, perf-test, prod), set these in CDP Portal:

```bash
# Optional overrides (only if auto-computed values are wrong):
BACKEND_URL=https://content-reviewer-backend.dev.cdp-int.defra.cloud
CDP_UPLOADER_S3_BUCKET=dev-service-optimisation-c63f2

# Environment-specific settings:
LOG_LEVEL=info              # Or debug for dev/test
ENABLE_METRICS=true         # Production monitoring
```

**Note:** Most of these are optional now because config auto-computes them!

---

## 📋 Environment Variables Reference

### 🔵 Auto-Computed (No Configuration Needed)

| Variable          | Dev Value                        | Test Value                         | How It's Set                |
| ----------------- | -------------------------------- | ---------------------------------- | --------------------------- |
| `backendUrl`      | `https://...dev...`              | `https://...test...`               | Computed from `ENVIRONMENT` |
| `s3Bucket`        | `dev-service-optimisation-c63f2` | `test-service-optimisation-bucket` | Mapped from `ENVIRONMENT`   |
| `cdpUploader.url` | Same as backendUrl               | Same as backendUrl                 | Uses backend URL            |

### 🟢 CDP-Injected (Automatic)

| Variable                  | Source       | Example               |
| ------------------------- | ------------ | --------------------- |
| `ENVIRONMENT`             | CDP Platform | `dev`, `test`, `prod` |
| `SERVICE_VERSION`         | CDP Build    | `abc123`              |
| `SESSION_COOKIE_PASSWORD` | CDP Secrets  | `***`                 |
| `REDIS_PASSWORD`          | CDP Secrets  | `***`                 |

### 🟡 Static (Same for All)

| Variable               | Value        | Purpose                  |
| ---------------------- | ------------ | ------------------------ |
| `NODE_ENV`             | `production` | Always production in CDP |
| `PORT`                 | `3000`       | Application port         |
| `SESSION_CACHE_ENGINE` | `redis`      | Use Redis in CDP         |
| `REDIS_TLS`            | `true`       | Secure Redis connection  |
| `LOG_FORMAT`           | `ecs`        | ECS log format for AWS   |

### 🟠 Optional Overrides (If Needed)

| Variable                 | When to Override                   |
| ------------------------ | ---------------------------------- |
| `BACKEND_URL`            | Only if auto-computed URL is wrong |
| `CDP_UPLOADER_S3_BUCKET` | Only if bucket naming differs      |
| `LOG_LEVEL`              | To change from default `info`      |

---

## 🚀 Deployment Guide

### Local Development

```bash
# 1. Copy template
cp .env.example .env

# 2. Customize (optional - smart defaults work)
cat > .env << 'EOF'
NODE_ENV=development
ENVIRONMENT=local
LOG_LEVEL=debug
LOG_FORMAT=pino-pretty
SESSION_CACHE_ENGINE=memory
EOF

# 3. Start application
npm run dev

# Config automatically uses:
# - BACKEND_URL: http://localhost:3001 (computed)
# - S3_BUCKET: dev-service-optimisation-c63f2 (computed)
```

### CDP Deployment (Dev Environment)

```bash
# 1. In CDP Portal, set ONLY this:
ENVIRONMENT=dev

# 2. Application automatically computes:
# - backendUrl: https://content-reviewer-backend.dev.cdp-int.defra.cloud
# - s3Bucket: dev-service-optimisation-c63f2
# - cdpUploader.url: (same as backendUrl)

# 3. CDP provides automatically:
# - SERVICE_VERSION
# - SESSION_COOKIE_PASSWORD (from Secrets Manager)
# - REDIS_* (from managed service)

# 4. Deploy!
# No .env file in container needed - everything is computed or injected!
```

### CDP Deployment (Test Environment)

```bash
# In CDP Portal, set:
ENVIRONMENT=test

# Application automatically uses:
# - backendUrl: https://content-reviewer-backend.test.cdp-int.defra.cloud
# - s3Bucket: test-service-optimisation-bucket
```

### CDP Deployment (Prod Environment)

```bash
# In CDP Portal, set:
ENVIRONMENT=prod
LOG_LEVEL=warn  # Override for production

# Application automatically uses:
# - backendUrl: https://content-reviewer-backend.prod.cdp-int.defra.cloud
# - s3Bucket: prod-service-optimisation-bucket
```

---

## 🗂️ File Structure Changes

### Delete These Files ❌

```
content-reviewer-frontend/
├── .env.dev          # ❌ DELETE - Not needed anymore
├── .env.test         # ❌ DELETE - Not needed anymore
├── .env.perf-test    # ❌ DELETE - Not needed anymore
└── .env.prod         # ❌ DELETE - Not needed anymore
```

### Keep These Files ✅

```
content-reviewer-frontend/
├── .env.example      # ✅ KEEP - Template for all environments
├── .env              # ✅ KEEP - Local dev only (gitignored)
└── src/config/
    └── config.js     # ✅ UPDATED - Now auto-computes values
```

---

## 📊 Configuration Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│  CDP Platform (or Local Machine)                    │
├─────────────────────────────────────────────────────┤
│  Environment Variables:                             │
│  • ENVIRONMENT=dev                                  │
│  • NODE_ENV=production                              │
│  • SESSION_COOKIE_PASSWORD=***                      │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  src/config/config.js                               │
├─────────────────────────────────────────────────────┤
│  Smart Defaults:                                    │
│  • Reads ENVIRONMENT variable                       │
│  • Computes backendUrl from ENVIRONMENT             │
│  • Maps S3 bucket from ENVIRONMENT                  │
│  • Selects cache engine based on ENV               │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  Application Runtime                                │
├─────────────────────────────────────────────────────┤
│  config.get('backendUrl')                           │
│  → https://...backend.dev.cdp-int.defra.cloud       │
│                                                     │
│  config.get('cdpUploader.s3Bucket')                 │
│  → dev-service-optimisation-c63f2                   │
└─────────────────────────────────────────────────────┘
```

---

## 🔐 Security Best Practices

### ✅ Do This

```bash
# Store secrets in CDP Secrets Manager
SESSION_COOKIE_PASSWORD=***   # Via CDP Secrets
REDIS_PASSWORD=***           # Via CDP Secrets

# Use environment variable for environment
ENVIRONMENT=dev              # Set in CDP Portal

# Let config compute the rest
# No hardcoded URLs in .env files!
```

### ❌ Don't Do This

```bash
# Don't commit secrets to .env files
SESSION_COOKIE_PASSWORD=my-secret-123  # ❌ NEVER!

# Don't duplicate URLs in multiple .env files
.env.dev: BACKEND_URL=https://...dev...
.env.test: BACKEND_URL=https://...test...  # ❌ Duplication!

# Don't use different .env files per environment
if [ "$ENV" == "dev" ]; then
  cp .env.dev .env  # ❌ Error-prone!
fi
```

---

## 🧪 Testing the Configuration

### Verify Auto-Computed Values

Add this to your startup script or run manually:

```javascript
import { config } from './src/config/config.js'

console.log('='.repeat(60))
console.log('Configuration Loaded:')
console.log('='.repeat(60))
console.log('Environment:', config.get('cdpEnvironment'))
console.log(
  'Node ENV:',
  config.get('isProduction') ? 'production' : 'development'
)
console.log('Backend URL:', config.get('backendUrl'))
console.log('S3 Bucket:', config.get('cdpUploader.s3Bucket'))
console.log('S3 Path:', config.get('cdpUploader.s3Path'))
console.log('Session Engine:', config.get('session.cache.engine'))
console.log('Log Level:', config.get('log.level'))
console.log('Log Format:', config.get('log.format'))
console.log('='.repeat(60))
```

### Expected Output (Dev)

```
============================================================
Configuration Loaded:
============================================================
Environment: dev
Node ENV: production
Backend URL: https://content-reviewer-backend.dev.cdp-int.defra.cloud
S3 Bucket: dev-service-optimisation-c63f2
S3 Path: content-uploads
Session Engine: redis
Log Level: info
Log Format: ecs
============================================================
```

### Expected Output (Local)

```
============================================================
Configuration Loaded:
============================================================
Environment: local
Node ENV: development
Backend URL: http://localhost:3001
S3 Bucket: dev-service-optimisation-c63f2
S3 Path: content-uploads
Session Engine: memory
Log Level: debug
Log Format: pino-pretty
============================================================
```

---

## 📝 Migration Checklist

- [x] ✅ Updated `src/config/config.js` with smart defaults
- [x] ✅ Created comprehensive `.env.example` template
- [x] ✅ Created `CDP_ENV_CONFIG.md` documentation
- [ ] Test locally with new config
- [ ] Configure environment variables in CDP Portal (dev)
- [ ] Deploy to dev and verify auto-computed values
- [ ] Configure other environments (test, perf-test, prod)
- [ ] Delete old `.env.dev`, `.env.test`, `.env.perf-test`, `.env.prod` files
- [ ] Update `.gitignore` to only ignore `.env`
- [ ] Update deployment documentation
- [ ] Train team on new approach

---

## 💡 Key Benefits

| Benefit                    | Impact                                           |
| -------------------------- | ------------------------------------------------ |
| **Single Source of Truth** | One `.env.example` template for all environments |
| **Auto-Computed URLs**     | No manual URL updates per environment            |
| **Less Error-Prone**       | Can't accidentally use wrong .env file           |
| **Easier Maintenance**     | Update config.js once, works everywhere          |
| **Better Security**        | No secrets in repository                         |
| **CDP Best Practice**      | Follows 12-factor app methodology                |
| **Simpler Deployments**    | Just set ENVIRONMENT variable in CDP             |

---

## 🎓 Learning Resources

- **12-Factor App Methodology**: https://12factor.net/config
- **CDP Platform Docs**: https://docs.cdp-int.defra.cloud/
- **Convict Config Library**: https://github.com/mozilla/node-convict
- **Environment Variables Best Practices**: https://nodejs.dev/en/learn/how-to-read-environment-variables-from-nodejs/

---

## 📞 Support

If you encounter issues with the new configuration:

1. **Verify ENVIRONMENT variable is set** in CDP Portal
2. **Check config startup logs** to see computed values
3. **Test locally first** with `ENVIRONMENT=local`
4. **Review CDP_ENV_CONFIG.md** for detailed guidance

---

**Status**: ✅ Configuration simplified and ready for deployment

**Next Steps**: Test locally → Deploy to dev → Verify → Roll out to other environments
