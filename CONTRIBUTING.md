# Contributing to JSandy

Thank you for your interest in contributing to JSandy! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to abide by our code of conduct. Please be respectful and considerate in all interactions.

## Getting Started

### Prerequisites

- Bun 1.0 or higher
- Git

### Development Setup

1. Fork the repository on GitHub
2. Clone your fork locally:

   ```bash
   git clone https://github.com/your-username/jsandy.git
   cd jsandy
   ```

3. Install dependencies:

   ```bash
   bun install
   ```

4. Create a new branch for your feature:

   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Building

To build all packages:

```bash
bun build
```

To build a specific package:

```bash
bun --filter @jsandy/rpc build
```

### Testing

Run all tests:

```bash
bun test
```

Run tests for a specific package:

```bash
bun --filter @jsandy/rpc test
```

Run tests in watch mode:

```bash
bun test:watch
```

### Linting and Formatting

Format code:

```bash
bun format
```

Lint code:

```bash
bun lint
```

### Type Checking

Check types across all packages:

```bash
bun check-types
```

## Project Structure

This is a monorepo managed with Turborepo and Bun workspaces:

```sh
jsandy/
├── packages/
│   ├── rpc/              # @jsandy/rpc - RPC framework
│   ├── builder/          # @jsandy/builder - Build tooling
│   ├── typescript-config/ # @jsandy/typescript-config - Shared TS configs
│   └── biome-config/     # @jsandy/biome-config - Shared Biome configs
├── package.json          # Root package.json
├── bun.lockb            # Bun lockfile
└── turbo.json           # Turborepo config
```

## Contributing Guidelines

### Creating Issues

Before creating an issue, please:

- Check if a similar issue already exists
- Use a clear, descriptive title
- Provide detailed information about the problem or feature request
- Include steps to reproduce (for bugs)

### Pull Requests

1. **Keep PRs focused**: One feature or fix per PR
2. **Write clear commit messages**: Use conventional commit format when possible
3. **Test your changes**: Ensure all tests pass
4. **Update documentation**: Update relevant README files and documentation
5. **Follow coding standards**: Use the project's linting and formatting rules

### Commit Message Format

We recommend using conventional commit format:

```sh
type(scope): description

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:

```
feat(rpc): add WebSocket subscription support
fix(builder): resolve TypeScript compilation issue
docs(readme): update installation instructions
```

### Code Style

- Use TypeScript for all code
- Follow the existing code style (enforced by Biome)
- Write meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused

### Adding New Packages

When adding a new package:

1. Create the package directory under `packages/`
2. Include a `package.json` with proper naming (`@jsandy/package-name`)
3. Add a `README.md` with usage examples
4. Include appropriate TypeScript configuration
5. Add tests with good coverage
6. Update the root README.md to list the new package

### Testing

- Write unit tests for all new features
- Aim for high test coverage
- Use descriptive test names
- Test edge cases and error conditions
- Keep tests isolated and independent

### Documentation

- Update README files when adding features
- Include code examples in documentation
- Document breaking changes clearly
- Use clear, concise language

## Release Process

This project uses Changesets for version management:

1. Run `bun changeset` to create a changeset
2. Describe your changes following the prompts
3. Commit the changeset file with your PR
4. Releases are automated when changesets are merged to main

## Package-Specific Guidelines

### @jsandy/rpc

- Maintain backwards compatibility when possible
- Add comprehensive tests for new procedures and middleware
- Update TypeScript types appropriately
- Document new APIs in the README

### @jsandy/builder

- Ensure build tools work across different environments
- Test with various TypeScript configurations
- Maintain compatibility with major bundlers

## Getting Help

- Check existing issues and discussions
- Ask questions in issue comments
- Reach out to maintainers if needed

## License

By contributing to JSandy, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing to JSandy! 🎉
