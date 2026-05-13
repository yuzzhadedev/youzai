# Pull Request Manual

## Prerequisites

- Ensure you have the latest `origin/main`.
- Ensure your changes are on a separate branch (not `main`).
- Do not commit secrets (API keys, Supabase service role keys, admin tokens, or `.env` files).

## Create a Feature Branch

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c <type>/<short-description>
```

Recommended branch name patterns:

- `feat/<short-description>`
- `fix/<short-description>`
- `chore/<short-description>`

## Make Changes and Commit

```bash
git status
git add -A
git commit -m "<type>: <summary>"
```

Commit message examples:

- `feat: add settings page sections`
- `fix: handle missing auth cookie`
- `chore: update vercel headers`

## Run Local Checks

Install dependencies (first time or when dependencies change):

```bash
npm ci
```

Syntax check all JavaScript files:

```bash
npm run check
```

Run the local dev environment (Vercel):

```bash
npm run dev
```

## Rebase or Merge Latest Main

Prefer rebasing to keep history clean (unless your team standard is merge commits):

```bash
git fetch origin
git rebase origin/main
```

If conflicts occur:

```bash
git status
git add -A
git rebase --continue
```

## Push the Branch

```bash
git push -u origin HEAD
```

## Open the Pull Request

Create the PR in your Git hosting UI:

- Base: `main` (or `origin/main`)
- Compare: your branch (e.g. `feat/...`)

PR description should include:

- What changed (short summary)
- Why it changed (context / issue link)
- How to test (steps and URLs)
- Risk/impact (what could break, rollout notes)

## Review Checklist (Author)

- No secrets, tokens, or credentials added.
- Public pages render correctly:
  - `public/index.html`
  - `public/login/index.html`
  - `public/settings/index.html`
- API endpoints still behave correctly:
  - `api/health.js`
  - `api/youz.js`
  - `api/auth/*`
- Vercel routing and headers remain valid (`vercel.json`).
- All checks pass:
  - `npm run check`

## After Approval

If required, update your branch with latest `main` again and resolve conflicts, then push.

Once merged:

```bash
git switch main
git pull --ff-only origin main
git branch -d <your-branch>
git push origin --delete <your-branch>
```
