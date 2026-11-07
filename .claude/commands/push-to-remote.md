---
description: Push local CMS DB content (settings, taxonomy, posts) to production via the sync API.
argument-hint: [resource...|all]
---

# /push-to-remote

Push local Postgres rows to the production database through the bearer-token sync API (`/api/admin/sync/*`).

> This is the **DB-content** half of "publish". The **code/app** half is [/git-push](git-push.md) (commit & push to GitHub → Coolify auto-redeploy). They're separate: this command never touches git; `/git-push` never touches the sync API.

**Arguments**: `$ARGUMENTS` — one or more of `settings`, `taxonomy`, `posts`, or `all`. If empty, default to a guided flow: show the user what's locally different and ask which resources to push.

## Workflow

1. **Sanity-check env**. Confirm both `REMOTE_SYNC_URL` and `SYNC_API_TOKEN` are present in the local `.env`. If either is missing, explain the setup steps from [.claude/skills/remote-db-sync/SKILL.md](../skills/remote-db-sync/SKILL.md) and stop.

2. **Show a preview** of what will change before pushing. For each requested resource:
   - `settings` — list local setting keys that will be upserted.
   - `taxonomy` — count of categories and tags.
   - `posts` — list slugs + statuses (published / draft / archived) that will be upserted.

   Use small SQL via `psql` or a `db.select()` snippet through `npx tsx` to gather the preview.

3. **Confirm with the user** when pushing >10 rows or `all`.

4. **Run the push**:
   ```bash
   npx tsx scripts/push-to-remote.ts $ARGUMENTS
   ```
   Stream the script output verbatim to the user. The script runs resources in dependency order (`taxonomy → settings → posts`) regardless of argument order.

5. **Verify**. After a successful push, hit a public production URL to spot-check (`curl -sI https://ai4kids.tertiarycourses.com.sg/` for nav, or fetch a specific page's HTML and grep for the new content). Report back the verification result.

## Safety rules

- **Never** push without showing the preview. Silent overwrites of production content destroy trust.
- **Never** push if the user appears to have been editing production via the admin UI — that work could be overwritten. Ask first.
- **Never** sync `users`, `leads`, or `media` through this command. They're explicitly out of scope (see the skill).
- If a push fails partway through, surface the exact endpoint that 4xx'd. Don't retry blindly — investigate the root cause (FK ordering, token mismatch, missing menu shell on remote).

## Examples

```
/push-to-remote posts
/push-to-remote taxonomy posts
/push-to-remote all
```
