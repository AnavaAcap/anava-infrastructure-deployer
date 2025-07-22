# Task Completion Checklist

When completing a coding task in Anava Vision, ensure:

## Before Committing
1. **Type Check**: Run `npm run typecheck` to ensure no TypeScript errors
2. **Lint**: Run `npm run lint` to check code style
3. **Test**: Run `npm run test` to ensure all tests pass
4. **Build**: Run `npm run build` to verify the app builds successfully

## Code Quality Checks
- No hardcoded API keys or secrets
- All Google Cloud API calls have proper error handling
- UI components show loading states during async operations
- Service classes follow single responsibility principle
- All deployments are idempotent (can be run multiple times safely)

## Version Update
- Update version in package.json when adding features or fixes
- Follow semantic versioning (major.minor.patch)

## Documentation
- Update README.md if adding new features
- Add JSDoc comments for public methods
- Update type definitions if changing interfaces