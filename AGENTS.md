# Repository instructions

- Always use Bun as the package manager and runtime for project commands. Use `bun install`, `bun add`, `bun remove`, and `bun run`; do not use npm, pnpm, or Yarn.
- When running a type check, use `bun run typecheck`.
- Do not run builds, Biome checks, or project scripts unless the user explicitly asks.
