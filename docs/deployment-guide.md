# Deployment Guide — hgl-wms

## Target platform

README states **Railway**. There is **no committed Railway config, Dockerfile, docker-compose.yml, or vercel.json** anywhere in this repo — deployment is configured entirely in the Railway dashboard, outside version control.

## CI/CD pipeline

Four GitHub Actions workflows govern promotion, none of which currently perform an actual deploy step:

| Workflow                | Trigger                                | What it does                                                                                                                                  |
| ----------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`                | push/PR to `dev`/`staging`/`QA`/`prod` | `npm ci` → `format:check` → `lint` → `test` → `build`                                                                                         |
| `ui.yml`                | same branches                          | validates required secrets present → `typecheck` → `biome:check` → `test` → `build` → Playwright install → `test:e2e:smoke` → `openapi:check` |
| `promotion-guard.yml`   | PR to `dev`/`staging`/`QA`/`prod`      | Enforces strict promotion order — only `dev → staging → QA → prod`; blocks merging back down the chain                                        |
| `environment-gates.yml` | push to `QA`/`prod`                    | Uses GitHub Environments for manual-approval gating; **steps are currently placeholder echoes** ("Deployment target is not configured yet")   |

## Branch flow

`dev → staging → QA → prod`, enforced by `promotion-guard.yml`. This matches the remote branches present in the repo (`dev`, `staging`, `QA`, `prod`).

## Environment configuration

Set via `.env.local` locally; presumably set as Railway environment variables in each deploy environment (not verifiable from this repo — no environment-specific config files are committed):

```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
EMAIL_MAX_RETRIES, EMAIL_BASE_DELAY_MS, EMAIL_MAX_DELAY_MS, EMAIL_USE_JITTER
NOTIFICATION_CHANNELS   (email, whatsapp — defaults to email)
```

## Gap worth flagging

`environment-gates.yml`'s placeholder steps and the absence of any Railway/Docker config mean **actual deploy automation is not yet wired into CI** — promotions between branches are guarded, but shipping to Railway itself appears to be a manual dashboard action today.
