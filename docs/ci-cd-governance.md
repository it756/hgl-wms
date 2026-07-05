# CI/CD Governance Setup

This repo uses a guarded promotion flow:

```text
jdmghk/core-tasks -> dev -> staging -> QA -> prod
```

The `QA` branch is intentionally uppercase to match the requested branch model.

## Branch Rules

- `dev` is seeded from `jdmghk/core-tasks`.
- Feature work targets `dev`.
- Only `dev` can merge into `staging`.
- Only `staging` can merge into `QA`.
- Only `QA` can merge into `prod`.
- Long-lived branches must be protected from force pushes and deletion.

## GitHub Actions

### CI Quality Checks

`.github/workflows/ci.yml` runs on pull requests and pushes to:

- `dev`
- `staging`
- `QA`
- `prod`

The quality gate runs:

```bash
npm ci
npm run format:check
npm run lint
npm test
npm run build
```

### Promotion Source Guard

`.github/workflows/promotion-guard.yml` validates the pull request source branch.

Examples:

- `dev` -> `staging` passes.
- `feature/foo` -> `staging` fails.
- `staging` -> `QA` passes.
- `dev` -> `QA` fails.
- `QA` -> `prod` passes.

### QA And Production Gates

`.github/workflows/environment-gates.yml` runs on pushes to `QA` and `prod`.

The jobs use GitHub Environments:

- `QA`
- `prod`

These are approval gates only for now. Deployment is intentionally a placeholder until a hosting provider is selected.

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

git switch -c staging dev
git push -u origin staging

git switch -c QA staging
git push -u origin QA

git switch -c prod QA
git push -u origin prod

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
npm test
npm run format:check
npm run lint
npm run build
```
