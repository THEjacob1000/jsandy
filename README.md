# JSandy

A modern TypeScript monorepo containing reusable packages and tools for building scalable applications.

## Packages

This monorepo includes the following packages:

### Core Packages

- `@jsandy/rpc`: A lightweight, TypeScript-based RPC framework built on Hono with WebSocket support
- `@jsandy/builder`: Build tooling and utilities for TypeScript projects
- `@jsandy/typescript-config`: Shared TypeScript configurations
- `@jsandy/biome-config`: Shared Biome configurations for linting and formatting

Each package is 100% [TypeScript](https://www.typescriptlang.org/) and designed for modern development workflows.

## Tools & Technologies

This monorepo uses modern development tools:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [Biome](https://biomejs.dev/) for fast linting and formatting
- [Turborepo](https://turbo.build/) for efficient monorepo management
- [Bun](https://bun.sh/) for fast package management and runtime

## Getting Started

### Prerequisites

- Bun 1.2+

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/JacobDevelops/jsandy.git
cd jsandy
bun install
```

### Development

To build all packages:

```bash
bun run build
```

To run tests:

```bash
bun test
```

To format and lint code:

```bash
bun format
bun lint
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to this project.

## License

This project is licensed under the MIT License - see the [LICENSE.md](licenses/LICENSE.md) file for details.

## Links

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [TypeScript](https://www.typescriptlang.org/)
- [Biome](https://biomejs.dev/)
- [Bun](https://bun.sh/)
