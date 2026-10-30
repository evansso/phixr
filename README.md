# Phixr

An AI troubleshooting assistant that helps you understand, diagnose, and fix technical problems through clear, safe, guided steps — and verifies the fix actually worked before calling it done.

Instead of dumping a long list of possible fixes, Phixr works like a careful technician: it gathers evidence first, asks only the questions that change the next step, guides you through one action at a time, and checks the real outcome of each step before moving on.

## Features

- **Evidence-based troubleshooting** — distinguishes confirmed facts, user reports, and hypotheses, and diagnoses before changing your system
- **Guided steps** — step-by-step instructions where you report the actual outcome of each step (`matched expected`, `different result`, `error`, …) so Phixr can adapt
- **Smart questionnaires** — short, targeted questions only when the answer changes what to do next
- **Web research** — searches the web and fetches pages (Exa) when current external facts matter, with sources
- **Troubleshooting skills** — loadable playbooks (e.g. Linux Wi-Fi, the troubleshooting loop) the assistant pulls in when relevant
- **Persistent cases** — every chat is a saved session with its messages, questionnaires, and step results, so context is never lost
- **Image uploads** — attach screenshots and error photos to your messages (up to 5 MB)
- **Voice input** — dictate your problem instead of typing (Deepgram)
- **Accounts** — sign up and keep your troubleshooting sessions across visits (Clerk)

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | [TanStack Start](https://tanstack.com/start) (React 19, file-based routing, SSR) + Vite |
| Server | [Nitro](https://nitro.build/) (deployable to Vercel or any Node-compatible host) |
| Database / backend | [Convex](https://convex.dev/) |
| Auth | [Clerk](https://clerk.com/) |
| AI | Vercel AI SDK streaming chat, Meta Muse model (`muse-wonder-1.0`) via Meta Responses API |
| Research | [Exa](https://exa.ai/) search + page fetching |
| File uploads | Upstash Blob (direct browser uploads via signed URLs) |
| Speech | Deepgram (voice input tokens) |
| UI | Tailwind CSS 4, shadcn/ui, Base UI, Motion, Lucide icons |
| Tooling | Bun, TypeScript, Biome (via Ultracite) |

## Getting started

Prerequisites: [Bun](https://bun.sh/), a [Clerk](https://clerk.com/) app, and a [Convex](https://convex.dev/) account.

```bash
bun install
cp .env.example .env   # then fill in your keys — see below
bun run convex:dev     # create/connect a Convex deployment (terminal 1)
bun run dev            # start the app at http://localhost:3000 (terminal 2)
```

### Environment variables

Copy `.env.example` to `.env` and set:

| Variable | What it's for |
| --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable (public) key |
| `CLERK_SECRET_KEY` | Clerk secret key (server only) |
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk Frontend API URL / JWT issuer |
| `VITE_CONVEX_URL` | Your Convex deployment URL |
| `VITE_CONVEX_SITE_URL` | Your Convex site URL |
| `CONVEX_DEPLOYMENT` | Convex deployment name (set by `convex dev`) |
| `CONVEX_DEPLOY_KEY` | Convex deploy key (server only) |
| `MUSE_META_API_KEY` | Meta AI API key for the chat model |
| `EXA_API_KEY` | Exa API key for web research |
| `UPSTASH_BLOB_TOKEN` | Token for a **public** Upstash Blob bucket (image uploads) |
| `DEEPGRAM_API_KEY` | Deepgram key for voice input |
| `AI_GATEWAY_API_KEY` | Optional AI Gateway key |

Clerk + Convex wiring: in the Clerk Dashboard, create a JWT template named `convex`, then set `CLERK_JWT_ISSUER_DOMAIN` in your Convex deployment environment. `convex/auth.config.ts` is published when you run `bun run convex:dev`.

> ⚠️ Never commit `.env` files — they contain secrets. All `.env*` files are git-ignored (only `.env.example`, with empty values, is tracked).

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Dev server on port 3000 |
| `bun run convex:dev` | Run Convex in dev mode |
| `bun run build` | Production build (Vite + Nitro) |
| `bun run preview` | Preview the production build |
| `bun run start` | Run the built server (`.output/server/index.mjs`) |
| `bun run typecheck` | Type check |
| `bun run check` / `bun run fix` | Lint/format check or auto-fix (Ultracite/Biome) |
| `bun run generate-routes` | Regenerate TanStack Router route tree |

## Project structure

```
src/
  routes/          File-based routes: (auth) login/register, (dash) chat UI,
                   and API routes (api.chat, api.upload, api.dg-token, …)
  components/      Chat UI, agent SDK components, shadcn/ui primitives
  lib/             System prompt, guide-steps & questionnaire tools,
                   web research, troubleshooting skills, uploads
  hooks/           Shared React hooks
convex/            Schema (sessions, messages, questionnaires, guide results)
                   and backend functions
skills/            Troubleshooting playbooks the assistant can load
public/            Static assets (logos, favicon, OG image)
```

## Deployment

The app builds to a self-contained Nitro server and is configured for Vercel (`vercel.json`, TanStack Start framework preset, Bun 1.x):

```bash
bun run build
bun run start
```

Set the same environment variables in your host's dashboard. Any Node-compatible host (Vercel, Render, Fly.io, a VPS, …) works.
