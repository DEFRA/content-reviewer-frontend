### Coding Rules for Copilot

Follow all rules below when generating or refactoring code:

1. Do not change the business logic or functional behavior.
2. Do not hard‑code values; use existing constants or configuration.
3. Follow all project ESLint rules strictly.
4. Use one variable per const declaration; no comma-separated declarations.
5. Do not use destructuring in this function.
6. Remove unused variables, dead code, and unreachable branches.
7. Always use curly braces for if/else/loop blocks, even for single statements.
8. Always add semicolons where required.
9. Use const for values that never change; use let only when reassignment is needed.
10. Keep functions focused: one responsibility per function.
11. Avoid deeply nested logic; prefer early returns.
12. If a function exceeds ~20–30 lines, split it into smaller functions.
13. Write comments that explain _why_, not _what_.
14. Ensure readability: clear naming, consistent formatting, and simple control flow.
15. Refactor code to improve clarity without altering behavior
