# Code Style and Conventions

## TypeScript Configuration
- Target: ES2022
- Module: ESNext
- Strict mode enabled
- Path aliases configured (@/, @main/, @renderer/, @shared/, @types/)
- No unused locals/parameters
- No implicit returns
- Source maps and declarations enabled

## ESLint Rules
- Extends eslint:recommended and @typescript-eslint/recommended
- React hooks rules enforced
- React in JSX scope disabled (React 17+)
- Explicit any warnings (not errors)
- Unused vars warning with underscore prefix ignored

## Naming Conventions
- PascalCase for components and classes
- camelCase for functions and variables
- Interfaces suffixed with Props for component props
- Service classes suffixed with their domain (e.g., GCPAuthService, FirebaseAuthDeployer)

## File Structure
- src/main/ - Electron main process code
- src/renderer/ - React UI code
- src/types/ - Shared TypeScript definitions
- functions/ - Cloud Functions source code
- assets/ - Application assets