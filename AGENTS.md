# Expo versioned docs

Before writing Expo-specific code, check the installed Expo SDK version in `package.json` and read its exact versioned documentation. This project currently uses Expo SDK 58; use https://docs.expo.dev/versions/v58.0.0/ instead of the unversioned or latest docs. Recheck this instruction when the SDK dependency changes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
