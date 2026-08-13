<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Working across sessions

This repo is actively edited by more than one Claude Code session (different computers, same person) and possibly a human collaborator too, often without either side knowing what the other just did. Follow this before/after any work session here:

- **Pull before starting.** Run `git fetch origin && git log --oneline origin/master -5` (or just `git pull`) before making changes — check what landed since you last worked here, not just what you remember.
- **Push promptly, in small commits.** Don't sit on a large uncommitted diff across multiple features — the longer it sits, the more likely another session pushes something that conflicts with it. One logical change per commit, pushed as soon as it's verified.
- **Call out pending migrations explicitly in the commit message.** If a commit needs a `supabase/migrations/000N_*.sql` file run before the code works, say so in the commit message (this has been the practice — keep it). The person running migrations may not be the one who wrote the code.
- **Check CI before assuming a push is safe.** This repo has a GitHub Actions build check (`.github/workflows/build.yml`) — check its status on the commit before assuming a push compiles, rather than guessing from Netlify (which doesn't post deploy status back to GitHub for this repo).
- **If you find a bug in code the *other* session wrote, fix it in the same spirit it was written** — match existing patterns (RLS shape, business_id scoping convention, snapshot-at-insert-time precedent, etc.) rather than introducing a parallel convention. When in doubt, grep for how the same problem was already solved elsewhere in this codebase before inventing a new approach.
