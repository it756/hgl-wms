# Terraform Layout

This directory separates platform governance from future cloud infrastructure.

- `github/` manages GitHub branch protections, required checks, and environments.
- `aws/` is reserved for AWS provider/root configuration.
- `gcp/` is reserved for GCP provider/root configuration.
- `modules/` is reserved for reusable Terraform modules.
- `environments/` is reserved for environment-specific compositions.

The AWS, GCP, modules, and environment folders are scaffolding only. They do not
provision infrastructure yet.
