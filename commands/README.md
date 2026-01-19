# Claude Code Commands

This folder contains preprompt files to help with development of the LeadBox of Tricks Chrome Extension using Claude Code CLI.

## How to Use

When using Claude Code CLI, reference these preprompts to get context-aware assistance:

```bash
# Example: Debug an extension issue
claude "I'm seeing an error in the coming-soon checker, can you help? @commands/debug-extension.md"

# Example: Add a new feature
claude "I want to add a feature to detect duplicate vehicles @commands/add-feature.md"

# Example: Fix a bug
claude "The CSV matcher is not working correctly @commands/fix-bug.md"
```

## Available Commands

### 🐛 debug-extension.md
Comprehensive debugging guide for Chrome extension issues. Covers:
- Content script injection problems
- Storage issues
- Background service worker troubleshooting
- Popup communication
- Permissions issues
- Common debugging steps

**Use when**: Extension not working, seeing errors, troubleshooting issues

### ✨ add-feature.md
Complete guide for adding new features to the extension. Includes:
- Architecture overview
- Feature implementation checklist
- Code patterns and examples
- Storage, popup, and background integration
- Documentation requirements

**Use when**: Adding new functionality, extending existing features

### 🔧 fix-bug.md
Systematic approach to bug fixing. Covers:
- Bug reproduction and investigation
- Common bug categories (DOM, Storage, Messaging, API, Timing)
- Fix checklist
- Testing scenarios
- Code review guidelines

**Use when**: Fixing bugs, investigating issues, handling error reports

### ⚡ optimize-performance.md
Performance optimization guide. Includes:
- Performance goals and bottlenecks
- Optimization strategies for DOM, data processing, APIs
- Memory management
- Testing and measurement
- Extension-specific optimizations

**Use when**: Extension feels slow, optimizing features, improving UX

### 🏗️ refactor-module.md
Code refactoring best practices. Covers:
- When and why to refactor
- Common refactoring patterns
- Module organization
- Testing refactored code
- Documentation updates

**Use when**: Improving code quality, making code more maintainable

### 🧪 test-feature.md
Comprehensive testing guide. Includes:
- Manual testing checklists for all 7 features
- Edge cases and error handling
- Performance testing
- Compatibility testing
- Bug report templates
- Automated testing ideas

**Use when**: Testing features, ensuring quality, catching regressions

### 📝 update-docs.md
Documentation maintenance guide. Covers:
- When and what to update
- README.md structure
- Architecture documentation
- Code documentation standards
- Version management
- Documentation best practices

**Use when**: Adding features, fixing bugs, updating versions

## Quick Reference

| Task | Command File |
|------|-------------|
| Extension not working | debug-extension.md |
| Add new feature | add-feature.md |
| Fix a bug | fix-bug.md |
| Improve performance | optimize-performance.md |
| Clean up code | refactor-module.md |
| Test features | test-feature.md |
| Update docs | update-docs.md |

## Tips

1. **Be specific**: The more context you provide to Claude, the better the assistance
2. **Reference multiple**: You can reference multiple preprompts if needed
3. **Update preprompts**: These files should evolve with the project
4. **Add new ones**: Create new preprompts for recurring tasks

## Contributing

When adding new preprompt files:
1. Follow the existing structure
2. Include practical examples
3. Add checklists for step-by-step guidance
4. Keep it focused on one main topic
5. Update this README with the new command
