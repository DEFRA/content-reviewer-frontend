# CDP Portal Configuration - Frontend

## What to Set in CDP Portal (Per Environment)

This document shows **exactly what environment variables you need to configure** in the CDP Portal for each environment.

---

## 🎯 Minimal Configuration (Recommended)

### Required (Must Set)

| Variable      | Dev Value | Test Value | Perf-Test Value | Prod Value |
| ------------- | --------- | ---------- | --------------- | ---------- |
| `ENVIRONMENT` | `dev`     | `test`     | `perf-test`     | `prod`     |

**That's it!** Everything else is auto-computed or provided by CDP.

---

## 🔐 Secrets (Configure Once in CDP Secrets Manager)

Set these in **CDP Secrets Manager** (not as environment variables):

| Secret Name               | How to Generate                                                            | Notes                  |
| ------------------------- | -------------------------------------------------------------------------- | ---------------------- |
| `SESSION_COOKIE_PASSWORD` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | Must be 32+ chars      |
| `REDIS_PASSWORD`          | Auto-provided by CDP                                                       | If using managed Redis |

---

## 🎛️ Optional Configuration (Advanced)

Only set these if you need to override the smart defaults:

### Override Backend URL (Optional)

**When:** If auto-computed URL doesn't match your backend service name

| Environment | Auto-Computed Default                                            | Override If Needed                                               |
| ----------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| Dev         | `https://content-reviewer-backend.dev.cdp-int.defra.cloud`       | `BACKEND_URL=https://your-backend.dev.cdp-int.defra.cloud`       |
| Test        | `https://content-reviewer-backend.test.cdp-int.defra.cloud`      | `BACKEND_URL=https://your-backend.test.cdp-int.defra.cloud`      |
| Perf-Test   | `https://content-reviewer-backend.perf-test.cdp-int.defra.cloud` | `BACKEND_URL=https://your-backend.perf-test.cdp-int.defra.cloud` |
| Prod        | `https://content-reviewer-backend.prod.cdp-int.defra.cloud`      | `BACKEND_URL=https://your-backend.prod.cdp-int.defra.cloud`      |

### Override S3 Bucket (Optional)

**When:** If bucket naming convention differs from default

| Environment | Auto-Computed Default                   | Override If Needed                        |
| ----------- | --------------------------------------- | ----------------------------------------- |
| Dev         | `dev-service-optimisation-c63f2`        | `CDP_UPLOADER_S3_BUCKET=your-dev-bucket`  |
| Test        | `test-service-optimisation-bucket`      | `CDP_UPLOADER_S3_BUCKET=your-test-bucket` |
| Perf-Test   | `perf-test-service-optimisation-bucket` | `CDP_UPLOADER_S3_BUCKET=your-perf-bucket` |
| Prod        | `prod-service-optimisation-bucket`      | `CDP_UPLOADER_S3_BUCKET=your-prod-bucket` |

### Logging Configuration (Optional)

**When:** To adjust log verbosity per environment

```bash
# Development/Testing - More verbose
LOG_LEVEL=debug

# Production - Less verbose
LOG_LEVEL=warn
```

### Other Overrides (Rarely Needed)

```bash
# Only if you need non-standard configuration:
CDP_UPLOADER_S3_PATH=custom-path       # Default: content-uploads
REDIS_HOST=custom-redis.example.com    # Default: Provided by CDP
PORT=8080                              # Default: 3000
```

---

## 📋 Complete Configuration Examples

### Dev Environment (Minimal)

```bash
# In CDP Portal → Environment Variables:
ENVIRONMENT=dev

# That's it! Auto-computed values:
# ✅ backendUrl: https://content-reviewer-backend.dev.cdp-int.defra.cloud
# ✅ s3Bucket: dev-service-optimisation-c63f2
# ✅ session.cache.engine: redis
# ✅ log.format: ecs
```

### Dev Environment (With Overrides)

```bash
# In CDP Portal → Environment Variables:
ENVIRONMENT=dev
LOG_LEVEL=debug                        # More verbose for dev
BACKEND_URL=https://custom-backend-url # If backend URL differs

# In CDP Secrets Manager:
SESSION_COOKIE_PASSWORD=<generated-secret>
```

### Test Environment

```bash
# In CDP Portal → Environment Variables:
ENVIRONMENT=test

# Auto-computed:
# ✅ backendUrl: https://content-reviewer-backend.test.cdp-int.defra.cloud
# ✅ s3Bucket: test-service-optimisation-bucket
```

### Perf-Test Environment

```bash
# In CDP Portal → Environment Variables:
ENVIRONMENT=perf-test

# Auto-computed:
# ✅ backendUrl: https://content-reviewer-backend.perf-test.cdp-int.defra.cloud
# ✅ s3Bucket: perf-test-service-optimisation-bucket
```

### Prod Environment

```bash
# In CDP Portal → Environment Variables:
ENVIRONMENT=prod
LOG_LEVEL=warn                         # Less verbose for production

# In CDP Secrets Manager:
SESSION_COOKIE_PASSWORD=<strong-secret>

# Auto-computed:
# ✅ backendUrl: https://content-reviewer-backend.prod.cdp-int.defra.cloud
# ✅ s3Bucket: prod-service-optimisation-bucket
# ✅ All security settings enabled
```

---

## 🚀 Step-by-Step: Configure Dev Environment

1. **Login to CDP Portal**
   - Navigate to: https://portal.cdp-int.defra.cloud/

2. **Select Your Service**
   - Services → `content-reviewer-frontend`

3. **Navigate to Environment Variables**
   - Select environment: `dev`
   - Click: "Environment Variables"

4. **Add Required Variable**

   ```
   Key: ENVIRONMENT
   Value: dev
   ```

5. **Add Secret (One-Time)**
   - Navigate to: "Secrets"
   - Add secret:
     ```
     Name: SESSION_COOKIE_PASSWORD
     Value: <generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
     ```

6. **Save and Deploy**
   - Save changes
   - Deploy service

7. **Verify Configuration**
   - Check application logs for startup message showing computed values
   - Test application functionality

---

## 🔍 Verification Checklist

After deployment, verify these values in application logs:

```
Configuration Loaded:
✅ Environment: dev (matches ENVIRONMENT variable)
✅ Backend URL: https://content-reviewer-backend.dev.cdp-int.defra.cloud (auto-computed)
✅ S3 Bucket: dev-service-optimisation-c63f2 (auto-computed)
✅ Session Engine: redis (auto-selected for CDP)
✅ Log Format: ecs (auto-selected for production)
```

---

## 📊 Configuration Comparison

### Old Approach (Multiple .env Files)

```bash
# Had to maintain 4 files:
.env.dev:       ENVIRONMENT=dev, BACKEND_URL=..., S3_BUCKET=..., LOG_LEVEL=...
.env.test:      ENVIRONMENT=test, BACKEND_URL=..., S3_BUCKET=..., LOG_LEVEL=...
.env.perf-test: ENVIRONMENT=perf-test, BACKEND_URL=..., S3_BUCKET=..., LOG_LEVEL=...
.env.prod:      ENVIRONMENT=prod, BACKEND_URL=..., S3_BUCKET=..., LOG_LEVEL=...
```

**Variables to maintain per environment: 10+**

### New Approach (Single Variable)

```bash
# CDP Portal configuration:
Dev:       ENVIRONMENT=dev
Test:      ENVIRONMENT=test
Perf-Test: ENVIRONMENT=perf-test
Prod:      ENVIRONMENT=prod
```

**Variables to maintain per environment: 1** (plus optional overrides)

---

## 💡 Pro Tips

1. **Start Minimal**: Only set `ENVIRONMENT` variable initially
2. **Add Overrides As Needed**: If auto-computed values don't work, override specific variables
3. **Use Secrets Manager**: Never put secrets in environment variables
4. **Monitor Logs**: Check startup logs to verify computed values
5. **Test in Dev First**: Always test configuration changes in dev before promoting

---

## 🆘 Troubleshooting

### Issue: Backend URL is incorrect

**Solution:**

```bash
# Override in CDP Portal:
BACKEND_URL=https://correct-backend-url.dev.cdp-int.defra.cloud
```

### Issue: S3 bucket not found

**Solution:**

```bash
# Check auto-computed bucket name in logs
# If wrong, override in CDP Portal:
CDP_UPLOADER_S3_BUCKET=correct-bucket-name
```

### Issue: Session not persisting

**Solution:**

```bash
# 1. Verify SESSION_COOKIE_PASSWORD is set in Secrets Manager
# 2. Check Redis configuration in logs
# 3. Ensure REDIS_* variables are provided by CDP
```

### Issue: Too many logs in production

**Solution:**

```bash
# In CDP Portal for prod environment:
LOG_LEVEL=warn  # Or 'error' for even less
```

---

## 📞 Support Contacts

- **CDP Platform Support**: cdp-support@defra.gov.uk
- **Application Team**: [Your team contact]

---

**Last Updated**: January 2026  
**Maintained By**: Content Reviewer Frontend Team
