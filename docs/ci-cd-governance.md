# CI/CD Governance Setup

This repo uses a guarded promotion flow:

```text
dev -> QA -> staging -> main
```

The `QA` branch is intentionally uppercase to match the requested branch model.

## Branch Rules

- Feature work targets `dev`.
- PRs from any source branch can merge into `dev`.
- Only `dev` can merge into `QA`.
- Only `QA` can merge into `staging`.
- Only `staging` can merge into `main`.
- Long-lived branches must be protected from force pushes and deletion.

## GitHub Actions

### CI Quality Checks

`.github/workflows/ui.yml` and `.github/workflows/backend.yml` run on pull requests and pushes to:

- `dev`
- `QA`
- `staging`
- `main`

The quality gates run:

```bash
npm run lockfile:check
npm run migrations:check
npm run typecheck
npm run biome:check
npm run lint:backend
npm test
npm run test:backend
npm run openapi:check
npm audit --omit=dev --audit-level=high
npm run build
```

### Promotion Source Guard

`.github/workflows/promotion-guard.yml` validates the pull request source branch.

Examples:

- `feature/foo` -> `dev` passes.
- `dev` -> `QA` passes.
- `feature/foo` -> `QA` fails.
- `QA` -> `staging` passes.
- `dev` -> `staging` fails.
- `staging` -> `main` passes.

### AI PR Review

CodeRabbit is the AI PR reviewer for PRs into `dev`, `QA`, `staging`, and `main`.
Its behavior is configured in `.coderabbit.yaml`. GitHub Copilot is not part of
the required review or merge workflow.

The pull request template requires authors to provide spec/task context, test
evidence, and risk flags for security, migrations, dependencies, and operational
flows. CODEOWNERS requests review from `@it756`, `@b0yw0nder3100`, `@jdmghk`,
and `@batsy3` for repository changes.

### QA And Production Gates

`.github/workflows/environment-gates.yml` runs on pushes to `QA` and `main`.

The jobs use GitHub Environments:

- `QA`
- `prod`

`main` is the production branch. The production approval gate still uses the GitHub Environment named `prod`.

### QA Security Gates

`.github/workflows/qa-security.yml` runs on pull requests into `QA` and pushes to
`QA`. QA runs deeper validation than `dev`, including a focused smoke pack,
Gitleaks secret scanning, Semgrep SAST, production dependency vulnerability
scanning, and Aqua Trivy filesystem dependency vulnerability scanning. Terraform
branch protection marks these QA security jobs as required checks on the `QA`
branch only.

### Emergency Hotfixes

Normal production promotion is `staging` -> `main`. Emergency fixes can use a
`hotfix/*` branch directly into `main`, but they still require a pull request,
required status checks, and production review. After a hotfix lands in `main`,
back-merge or cherry-pick the fix into lower branches so `dev`, `QA`, and
`staging` do not drift from production.

## Required Secrets

The CI workflow can run with placeholder values for tests, but real environments should define:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASS`

Terraform needs a GitHub token with repository administration permissions:

```bash
export GITHUB_TOKEN=...
```

## Terraform

Terraform lives in:

```text
terraform/github
```

It manages:

- branch protection rules
- required status checks
- required PR reviews
- GitHub Environments for `QA` and `prod`

Create the branches with Git first:

```bash
git switch dev
git push -u origin dev

git switch -c QA dev
git push -u origin QA

git switch -c staging QA
git push -u origin staging

git switch main
git merge staging
git push -u origin main

git switch dev
```

Example setup:

```bash
cd terraform/github
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

Review the `terraform plan` carefully before applying branch protections. If a required status check name changes in GitHub, update `main.tf` before applying.

The GitHub provider expects numeric user/team IDs for environment reviewers. Keep reviewer lists empty only if reviewers will be configured manually in the GitHub UI.

On this local machine, `terraform validate` failed before reading the HCL because Terraform could not negotiate with the downloaded GitHub provider plugin. Re-run validation from CI or a clean Terraform installation before applying.

## Local Verification

Before opening a PR into `dev`, run:

```bash
npm run prepush
```
