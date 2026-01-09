# CDP Environment Configuration Guide - Frontend

## Overview

The frontend application uses **environment variables** that are injected by CDP at deployment time. Unlike the backend, the frontend has simpler configuration needs and **does not require separate `.env` files per environment**.

---

## 🎯 Recommended Approach

### ✅ Use Single `.env.example` + CDP Environment Variables

**Why this works:**

1. **CDP automatically injects** `ENVIRONMENT` variable (dev, test, perf-test, prod)
2. **Config file is smart** - it uses the `ENVIRONMENT` variable to compute URLs
3. **Most settings are static** across environments
4. **CDP manages secrets** (Redis, session passwords) automatically

### 📁 File Structure

```
content-reviewer-frontend/
├── .env.example          # Template for all environments (KEEP)
├── .env                  # Local development only (gitignored)
├── .env.dev             # ❌ DELETE - Not needed
├── .env.test            # ❌ DELETE - Not needed
├── .env.perf-test       # ❌ DELETE - Not needed
└── .env.prod            # ❌ DELETE - Not needed
```

---

## 📋 Environment Variables by Source

### 🔵 CDP Auto-Injected (No Action Needed)

These are automatically provided by CDP platform:

```bash
SERVICE_VERSION           # Git commit hash, injected at build time
ENVIRONMENT              # dev | test | perf-test | prod
```

### 🟢 CDP Secrets Manager (Configured Once)

These are stored in CDP Secrets Manager and injected at runtime:

```bash
SESSION_COOKIE_PASSWORD   # Random 32-char string
REDIS_PASSWORD           # Managed by CDP
```

### 🟡 CDP Environment-Specific (Set in CDP Portal)

These need to be configured in CDP portal for each environment:

```bash
# Backend Service URL
BACKEND_URL=https://content-reviewer-backend.{env}.cdp-int.defra.cloud

# S3 Bucket (via CDP-Uploader)
CDP_UPLOADER_S3_BUCKET=dev-service-optimisation-c63f2

# Redis Configuration (if not auto-provided)
REDIS_HOST=redis-{env}.cdp-int.defra.cloud
REDIS_USERNAME=content-reviewer
```

### 🟠 Static Configuration (Same for All Environments)

These can be in `.env.example` and copied to container:

```bash
NODE_ENV=production
PORT=3000
SESSION_CACHE_ENGINE=redis
REDIS_TLS=true
USE_SINGLE_INSTANCE_CACHE=false
LOG_FORMAT=ecs
ENABLE_SECURE_CONTEXT=true
ENABLE_METRICS=true
```

---

## 🔧 Smart Config Pattern

The `src/config/config.js` file uses conditional logic based on `ENVIRONMENT`:

```javascript
export const config = convict({
  cdpEnvironment: {
    doc: 'The CDP environment the app is running in',
    format: ['local', 'dev', 'test', 'perf-test', 'prod'],
    default: 'local',
    env: 'ENVIRONMENT'
  },

  backendUrl: {
    doc: 'Backend API URL',
    format: String,
    // Smart default based on environment
    default: isLocal
      ? 'http://localhost:3001'
      : 'https://content-reviewer-backend.dev.cdp-int.defra.cloud',
    env: 'BACKEND_URL' // Override via env var
  },

  sessionCacheEngine: {
    doc: 'Session cache engine',
    format: ['memory', 'redis'],
    // Auto-select based on environment
    default: isLocal ? 'memory' : 'redis',
    env: 'SESSION_CACHE_ENGINE'
  }
})
```

### 💡 Make Config Even Smarter

You can enhance the config to automatically compute URLs based on `ENVIRONMENT`:

```javascript
const cdpEnvironment = process.env.ENVIRONMENT || 'local'
const isLocal = cdpEnvironment === 'local'

export const config = convict({
  // ...existing config...

  backendUrl: {
    doc: 'Backend API URL',
    format: String,
    default: isLocal
      ? 'http://localhost:3001'
      : `https://content-reviewer-backend.${cdpEnvironment}.cdp-int.defra.cloud`,
    env: 'BACKEND_URL'
  },

  cdpUploader: {
    s3Bucket: {
      doc: 'S3 bucket for uploads',
      format: String,
      default: isLocal
        ? 'dev-service-optimisation-c63f2'
        : `${cdpEnvironment}-service-optimisation-c63f2`,
      env: 'CDP_UPLOADER_S3_BUCKET'
    }
  }
})
```

---

## 🚀 Deployment Process

### Local Development

1. **Copy template:**

   ```bash
   cp .env.example .env
   ```

2. **Customize for local:**
   ```bash
   NODE_ENV=development
   ENVIRONMENT=local
   BACKEND_URL=http://localhost:3001
   SESSION_CACHE_ENGINE=memory
   LOG_LEVEL=debug
   LOG_FORMAT=pino-pretty
   ```

### CDP Deployment

1. **No `.env` file needed in repository** (except `.env.example`)

2. **Configure in CDP Portal** (one-time per environment):
   - Navigate to: Service → Environment Variables
   - Set:
     ```
     BACKEND_URL=https://content-reviewer-backend.{env}.cdp-int.defra.cloud
     CDP_UPLOADER_S3_BUCKET={env}-service-optimisation-c63f2
     LOG_LEVEL=info
     ```

3. **CDP automatically provides:**
   - `ENVIRONMENT=dev` (or test, perf-test, prod)
   - `SERVICE_VERSION=abc123`
   - Redis connection details
   - Secrets from Secrets Manager

4. **Application reads from environment** and computes the rest

---

## 📊 Comparison: Old vs New Approach

### ❌ Old Approach (Multiple .env files)

```
.env.dev      →  Copy to container  →  NODE_ENV=production, BACKEND_URL=https://...dev...
.env.test     →  Copy to container  →  NODE_ENV=production, BACKEND_URL=https://...test...
.env.perf-test →  Copy to container  →  NODE_ENV=production, BACKEND_URL=https://...perf...
.env.prod     →  Copy to container  →  NODE_ENV=production, BACKEND_URL=https://...prod...
```

**Problems:**

- ❌ Duplicate configuration
- ❌ Manual file switching
- ❌ Risk of wrong file in wrong environment
- ❌ Secrets in files (security risk)

### ✅ New Approach (Single template + CDP injection)

```
.env.example  →  Template only (not used at runtime)
CDP Portal    →  Inject ENVIRONMENT=dev
Config.js     →  Compute backendUrl from ENVIRONMENT
CDP Secrets   →  Inject SESSION_COOKIE_PASSWORD
```

**Benefits:**

- ✅ Single source of truth
- ✅ Environment computed automatically
- ✅ No secrets in repository
- ✅ Less maintenance
- ✅ Follows CDP best practices

---

## 🔐 Secrets Management

### Never Commit These to Repository:

```bash
SESSION_COOKIE_PASSWORD    # Use CDP Secrets Manager
REDIS_PASSWORD            # Managed by CDP
AWS_ACCESS_KEY_ID         # Use IAM roles in CDP
AWS_SECRET_ACCESS_KEY     # Use IAM roles in CDP
```

### How CDP Handles Secrets:

1. **Store in CDP Secrets Manager:**
   - Navigate to: Service → Secrets
   - Add secret: `SESSION_COOKIE_PASSWORD`
   - CDP automatically injects as env var at runtime

2. **Use IAM Roles:**
   - For S3 access: No keys needed, uses pod IAM role
   - For SQS access: No keys needed, uses pod IAM role

---

## 📝 Migration Checklist

- [ ] Update `config.js` to compute URLs from `ENVIRONMENT`
- [ ] Create comprehensive `.env.example` file
- [ ] Configure environment variables in CDP portal for each environment
- [ ] Add secrets to CDP Secrets Manager
- [ ] Delete `.env.dev`, `.env.test`, `.env.perf-test`, `.env.prod`
- [ ] Update `.gitignore` to only ignore `.env` (keep `.env.example`)
- [ ] Update documentation to reference single `.env.example`
- [ ] Test deployment in dev environment
- [ ] Verify all computed values are correct

---

## 🧪 Testing the Configuration

### Verify Config Loading:

```javascript
// Add to index.js or server.js
import { config } from './config/config.js'

console.log('Configuration loaded:')
console.log('- Environment:', config.get('cdpEnvironment'))
console.log('- Backend URL:', config.get('backendUrl'))
console.log('- S3 Bucket:', config.get('cdpUploader.s3Bucket'))
console.log('- Session Engine:', config.get('sessionCacheEngine'))
```

### Expected Output (Dev Environment):

```
Configuration loaded:
- Environment: dev
- Backend URL: https://content-reviewer-backend.dev.cdp-int.defra.cloud
- S3 Bucket: dev-service-optimisation-c63f2
- Session Engine: redis
```

---

## 🎯 Summary

**For Frontend: Use Single `.env.example` + CDP Environment Variables**

| Aspect               | Approach                                                 |
| -------------------- | -------------------------------------------------------- |
| **Local Dev**        | Copy `.env.example` to `.env`, customize                 |
| **CDP Environments** | Set variables in CDP Portal, let config compute the rest |
| **Secrets**          | Use CDP Secrets Manager                                  |
| **URL Generation**   | Automatic based on `ENVIRONMENT` variable                |
| **Maintenance**      | Minimal - one template file only                         |

**This approach:**

- ✅ Follows CDP best practices
- ✅ Reduces configuration duplication
- ✅ Improves security (no secrets in repo)
- ✅ Simplifies deployment
- ✅ Makes environment differences explicit and computed

---

## 📚 Related Documentation

- [CDP Platform Documentation](https://docs.cdp-int.defra.cloud/)
- [Convict Configuration Library](https://github.com/mozilla/node-convict)
- [12-Factor App: Config](https://12factor.net/config)
