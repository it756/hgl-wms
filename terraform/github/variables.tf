variable "github_owner" {
  description = "GitHub organization or user that owns the repository."
  type        = string
}

variable "repository_name" {
  description = "Repository name without owner."
  type        = string
  default     = "hgl-wms"
}

variable "protected_branches" {
  description = "Long-lived branches that receive protection rules."
  type        = list(string)
  default     = ["dev", "QA", "staging", "main"]
}

variable "required_reviewer_user_ids_qa" {
  description = "GitHub numeric user IDs required to approve QA environment deployments."
  type        = list(number)
  default     = []
}

variable "required_reviewer_team_ids_qa" {
  description = "GitHub numeric team IDs required to approve QA environment deployments."
  type        = list(number)
  default     = []
}

variable "required_reviewer_user_ids_prod" {
  description = "GitHub numeric user IDs required to approve production environment deployments."
  type        = list(number)
  default     = []
}

variable "required_reviewer_team_ids_prod" {
  description = "GitHub numeric team IDs required to approve production environment deployments."
  type        = list(number)
  default     = []
}
