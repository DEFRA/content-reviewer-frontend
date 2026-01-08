# Frontend Architecture: Why Multiple index.js, controller.js, and index.njk Files?

**Date:** January 8, 2026  
**Status:** Documentation of architectural pattern

---

## 🎯 TL;DR - This is a Modular Route-Based Architecture

The multiple files with the same names (`index.js`, `controller.js`, `index.njk`) follow a **standard Node.js/Hapi.js modular architecture pattern**. Each module/route has its own self-contained directory with these three key files.

**This is a GOOD thing** - it's a well-organized, maintainable structure! ✅

---

## 📂 Directory Structure Pattern

Each route/feature follows this pattern:

```
src/server/
├── [route-name]/
│   ├── index.js          # Route registration (Hapi plugin)
│   ├── controller.js     # Request handler logic
│   └── index.njk         # Nunjucks template (view)
```

### Example: Home Route

```
src/server/home/
├── index.js              # Registers GET / route
├── controller.js         # Handles home page logic
└── index.njk             # Renders home page HTML
```

---

## 🏗️ Complete Structure

```
src/server/
├── router.js                    # Main router - registers all modules
├── server.js                    # Hapi server setup
│
├── home/                        # Homepage module
│   ├── index.js                # Route: GET /
│   ├── controller.js           # Handler for homepage
│   ├── controller.test.js      # Tests
│   └── index.njk               # Homepage template
│
├── about/                       # About page module
│   ├── index.js                # Route: GET /about
│   ├── controller.js           # Handler for about page
│   ├── controller.test.js      # Tests
│   └── index.njk               # About page template
│
├── health/                      # Health check module
│   ├── index.js                # Route: GET /health
│   ├── controller.js           # Handler for health check
│   └── controller.test.js      # Tests
│
├── upload/                      # File upload module
│   ├── index.js                # Routes: GET /upload, POST /upload
│   ├── controller.js           # Upload handlers
│   ├── controller.test.js      # Tests
│   └── index.njk               # Upload form template
│
└── review/                      # Review module (sub-module container)
    ├── index.js                # Registers sub-modules
    │
    ├── results/                # Review results sub-module
    │   ├── index.js            # Route: GET /review/results/:id
    │   ├── controller.js       # Results display handler
    │   ├── data-service.js     # Data fetching service
    │   └── index.njk           # Results page template
    │
    ├── export/                 # Export sub-module
    │   ├── index.js            # Route: GET /review/results/:id/export
    │   ├── controller.js       # Export handler (PDF/Word)
    │   └── (no template - generates files)
    │
    └── debug/                  # Debug/testing sub-module
        ├── index.js            # Route: GET /review/debug/:id
        ├── controller.js       # Debug view handler
        └── index.njk           # Debug page template
```

---

## 🔍 Why This Structure?

### 1. **Module Encapsulation**

Each feature is self-contained with all its code in one directory:

```
home/
├── index.js       → Route definition
├── controller.js  → Business logic
└── index.njk      → Presentation
```

**Benefits:**

- ✅ Easy to find related code
- ✅ Easy to add/remove features
- ✅ Clear separation of concerns

### 2. **Hapi.js Plugin Architecture**

Each `index.js` is a Hapi plugin that registers routes:

```javascript
// home/index.js
export const home = {
  plugin: {
    name: 'home',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/',
          ...homeController // From controller.js
        }
      ])
    }
  }
}
```

### 3. **Separation of Concerns**

| File              | Responsibility                                        |
| ----------------- | ----------------------------------------------------- |
| **index.js**      | Route registration, URL mapping, HTTP methods         |
| **controller.js** | Request handling, business logic, response generation |
| **index.njk**     | HTML template, presentation logic                     |

### 4. **Testability**

Each controller can be tested independently:

```javascript
// home/controller.test.js
import { homeController } from './controller.js'

describe('Home Controller', () => {
  it('should render home view', () => {
    // Test controller logic
  })
})
```

---

## 🔄 How It Works - Request Flow

### Example: User visits homepage (/)

```
1. Browser Request
   GET / HTTP/1.1

2. Hapi Router (router.js)
   → Finds 'home' plugin

3. Home Plugin (home/index.js)
   → Matches route: GET /
   → Calls homeController

4. Home Controller (home/controller.js)
   → handler(request, h)
   → Gets flash messages
   → Returns h.view('home/index', {...})

5. Nunjucks Template (home/index.njk)
   → Renders HTML with data
   → Extends base layout

6. Browser Response
   HTML page rendered
```

### Example: User uploads file (POST /upload)

```
1. Browser Request
   POST /upload
   Content-Type: multipart/form-data

2. Hapi Router
   → Finds 'upload' plugin

3. Upload Plugin (upload/index.js)
   → Matches route: POST /upload
   → Calls uploadController

4. Upload Controller (upload/controller.js)
   → handler(request, h)
   → Processes file
   → Sends to backend API
   → Returns response

5. Response
   JSON or redirect
```

---

## 📋 File Naming Convention

### Why "index.js" for Multiple Files?

**Answer:** Each file is in a different directory, so there's no conflict!

```
home/index.js          ← Different directory
about/index.js         ← Different directory
upload/index.js        ← Different directory
review/results/index.js ← Different directory
```

**In Node.js:**

```javascript
import { home } from './home/index.js'
// OR
import { home } from './home' // Auto-imports index.js
```

### Why "controller.js" for Multiple Files?

**Answer:** Same reason - different directories, and it makes the pattern consistent:

```
Every route module has:
- index.js       (route registration)
- controller.js  (request handler)
- index.njk      (template)
```

### Why "index.njk" for Multiple Files?

**Answer:** Nunjucks templates are referenced by their path:

```javascript
// In controller.js
h.view('home/index', {...})      // Renders home/index.njk
h.view('about/index', {...})     // Renders about/index.njk
h.view('upload/index', {...})    // Renders upload/index.njk
```

---

## 🎨 Pattern Benefits

### ✅ Pros

1. **Discoverability**
   - Want to modify homepage? → Look in `home/`
   - Want to modify upload? → Look in `upload/`

2. **Scalability**
   - Easy to add new features: create new directory
   - Easy to remove features: delete directory

3. **Maintainability**
   - All related code in one place
   - Clear file responsibilities

4. **Team Collaboration**
   - Different developers can work on different modules
   - Less merge conflicts

5. **Testing**
   - Test files next to source files
   - Easy to find and run tests

6. **Standard Pattern**
   - Common in Node.js/Hapi.js applications
   - Easy for new developers to understand

### ⚠️ Potential Confusion

1. **Multiple files with same name**
   - Can be confusing initially
   - IDE search might show multiple results
   - **Solution:** Use path in search (e.g., "home/index.js")

2. **Import clarity**
   - Need to specify full path
   - **Solution:** Use descriptive imports:
     ```javascript
     import { home } from './home/index.js'
     import { upload } from './upload/index.js'
     ```

---

## 🔧 Alternative Approaches (Not Used Here)

### Approach 1: Flat Structure

```
src/server/
├── home-routes.js
├── home-controller.js
├── about-routes.js
├── about-controller.js
└── upload-routes.js
```

**Issues:**

- ❌ Hard to manage with many routes
- ❌ No clear grouping
- ❌ Templates scattered

### Approach 2: Different Names

```
home/
├── routes.js
├── handlers.js
└── template.njk
```

**Issues:**

- ❌ Less consistent
- ❌ More cognitive load (different names to remember)

### Approach 3: Single File Per Route

```
src/server/
├── home.js (routes + controller + template reference)
├── about.js
└── upload.js
```

**Issues:**

- ❌ Large files
- ❌ Mixed concerns
- ❌ Harder to test

---

## 📚 Industry Standards

This pattern is used by:

- **Hapi.js** applications (official pattern)
- **Express.js** applications (common pattern)
- **Next.js** (pages/components structure)
- **NestJS** (module-based architecture)
- **Many enterprise Node.js applications**

**It's a well-established best practice!** ✅

---

## 🎓 Learning Resources

- **Hapi.js Plugins:** https://hapi.dev/tutorials/plugins/
- **Modular Architecture:** https://nodejs.dev/learn/nodejs-file-structure
- **Separation of Concerns:** https://en.wikipedia.org/wiki/Separation_of_concerns

---

## 🔍 Quick Reference

### When to Look Where

| Task               | File to Check                    |
| ------------------ | -------------------------------- |
| Change URL path    | `[module]/index.js`              |
| Change page logic  | `[module]/controller.js`         |
| Change HTML layout | `[module]/index.njk`             |
| Add new page       | Create new `[module]/` directory |
| Test a feature     | `[module]/controller.test.js`    |

### Finding Files in IDE

**VS Code Search:**

```
# Search for specific controller
Ctrl/Cmd + P → "home/controller.js"

# Search for all controllers
Ctrl/Cmd + Shift + F → "controller.js"

# View file tree
Focus on Explorer, expand src/server/
```

---

## ✅ Summary

**Question:** Why multiple index.js, controller.js, and index.njk files?

**Answer:**

- ✅ **Modular architecture** - Each feature is self-contained
- ✅ **Standard pattern** - Common in Node.js/Hapi.js
- ✅ **Separation of concerns** - Routes, logic, views separated
- ✅ **Maintainability** - Easy to find and modify code
- ✅ **Scalability** - Easy to add/remove features

**Verdict:** This is a **well-designed, professional structure**. Keep it! 🎉

---

## 🎯 Recommendations

1. **Keep this structure** - It's a good pattern
2. **Add JSDoc comments** - Document module purposes
3. **Create module index** - List all modules in main README
4. **Use consistent naming** - Stick to the pattern for new features

---

**Created:** January 8, 2026  
**Purpose:** Explain frontend architectural pattern  
**Status:** ✅ Structure is correct and follows best practices
