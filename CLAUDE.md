## Project Rules & Guidelines

### 1. Architecture Documentation
We maintain a living architecture document at `ARCHITECTURE_SUMMARY.md` in the root directory. 

Whenever you perform any of the following tasks:
* Add or remove a feature
* Modify the tech stack or dependencies
* Change the database schema or state management
* Restructure directories or core logic

You MUST automatically update `ARCHITECTURE_SUMMARY.md` to reflect these changes before completing your task. Ensure the document always remains an accurate, high-level representation of the current codebase.  

### 2. UI/UX & Styling Standards (Premium Tier)
* **Max UI/UX Polish:** All frontend components must be designed with top-tier UI/UX principles. Interfaces should be clean, accessible, and feel highly professional.
* **Framer Motion Integration:** Actively use `framer-motion` for layout changes, page transitions, and micro-interactions (e.g., `whileHover`, `whileTap`, staggered list entrances). Avoid abrupt UI snaps; state changes should always be buttery-smooth and deliberate to build user trust.

### 3. Pre-Build & Infrastructure Checks
* **Firebase CLI Verification:** Before writing data, building the app, or triggering any deployments, you MUST verify that the local environment is actively connected to the correct Firebase project via the Firebase CLI (e.g., checking the active project with `firebase use`). Never assume the environment is correctly linked without checking.