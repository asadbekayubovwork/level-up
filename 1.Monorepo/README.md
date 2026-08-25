# Monorepo

pnpm workspaces + Turborepo. Node 20, pnpm 10.

```bash
pnpm install
pnpm dev        # all apps in parallel
pnpm build      # topological, cached
pnpm typecheck  # vue-tsc across every package
```

## Layout

- `apps/*` — applications
- `packages/*` — shared packages, consumed as TypeScript source (no build step)

## Adding an app

```bash
pnpm create vite apps/<name> --template vue-ts
cd apps/<name>
pnpm add @repo/ui --workspace
```

Then in its `package.json` add `"typecheck": "vue-tsc --noEmit"`, and add a
`tsconfig.json` with `{ "extends": "../../tsconfig.json" }`. Turborepo picks the
app up from `pnpm-workspace.yaml` — no `turbo.json` change needed.

## Adding a shared package

Copy `packages/ui` — its `package.json` `exports` points `types` and `import` at
the `.ts` source, which is what gives consumers real cross-package type checking.
