data "github_repository" "repo" {
  full_name = "${var.github_owner}/${var.repository_name}"
}

locals {
  required_status_checks_common = [
    "Frontend CI gate",
    "API and service quality",
    "Supabase migration contract",
    "Backend dependency security",
    "promotion source guard",
  ]

  required_status_checks_qa = concat(local.required_status_checks_common, [
    "QA smoke pack",
    "Gitleaks secret scan",
    "Semgrep SAST",
    "Dependency vulnerability scan",
    "Aqua Trivy filesystem scan",
  ])
}

resource "github_branch_protection" "protected" {
  for_each = toset(var.protected_branches)

  repository_id = data.github_repository.repo.node_id
  pattern       = each.value

  enforce_admins                  = true
  allows_deletions                = false
  allows_force_pushes             = false
  require_conversation_resolution = true
  require_signed_commits          = false

  required_status_checks {
    strict   = !contains(["QA", "main"], each.value)
    contexts = each.value == "QA" ? local.required_status_checks_qa : local.required_status_checks_common
  }

  required_pull_request_reviews {
    dismiss_stale_reviews           = true
    require_code_owner_reviews      = false
    required_approving_review_count = each.value == "main" || each.value == "QA" ? 2 : 1
  }
}

locals {
  qa_environment_has_reviewers   = length(var.required_reviewer_user_ids_qa) > 0 || length(var.required_reviewer_team_ids_qa) > 0
  prod_environment_has_reviewers = length(var.required_reviewer_user_ids_prod) > 0 || length(var.required_reviewer_team_ids_prod) > 0
}

resource "github_repository_environment" "qa" {
  environment = "QA"
  repository  = var.repository_name

  dynamic "reviewers" {
    for_each = local.qa_environment_has_reviewers ? [1] : []

    content {
      users = var.required_reviewer_user_ids_qa
      teams = var.required_reviewer_team_ids_qa
    }
  }
}

resource "github_repository_environment" "prod" {
  environment = "prod"
  repository  = var.repository_name

  dynamic "reviewers" {
    for_each = local.prod_environment_has_reviewers ? [1] : []

    content {
      users = var.required_reviewer_user_ids_prod
      teams = var.required_reviewer_team_ids_prod
    }
  }
}
