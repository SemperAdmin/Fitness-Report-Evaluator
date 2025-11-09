# FITNESS-REPORT-EVALUATOR
Unbiased FITREP marking assistance tool

## Render CD: Automatic GitHub Issue Creation

This project can automatically create GitHub issues in `SemperAdmin/Fitness-Report-Evaluator` during continuous deployment on Render.com when specific events occur (failed builds, successful deployments). This helps capture context-rich signals straight from the deployment pipeline.

### Trigger Conditions
- Failed build: When the build step fails, an issue is created with truncated logs.
- Successful build (optional): If enabled, an issue is created after a successful build.
- Successful deployment start (optional): If enabled, an issue is created when the service start command is invoked.

Enable the optional success triggers by setting `CREATE_ISSUE_ON_DEPLOY_SUCCESS=true` in the Render service environment.

### Expected Issue Format
- Title: `[CD] <event> ...`
- Body includes:
  - Timestamp, service name, environment, external URL, commit SHA, Node version
  - For failures: truncated build logs for quick triage
- Labels: `feedback`, `<event>` plus `build`/`deploy` and `success`/`failure`
- Assignees: Optional; controlled via `ISSUE_ASSIGNEES` env var (comma-separated usernames)

### Setup on Render
1. In your Render service settings:
   - Build Command: `npm run render:build`
   - Start Command: `npm run render:start`
2. Environment variables (secure credentials):
   - `GITHUB_TOKEN`: Fine-grained PAT with permissions:
     - Repository permissions: Issues (Read/Write), Metadata (Read), Contents (Read)
   - `GITHUB_REPO`: `SemperAdmin/Fitness-Report-Evaluator` (defaulted if omitted)
   - `ISSUE_ASSIGNEES`: Optional comma-separated GitHub usernames
   - `CREATE_ISSUE_ON_DEPLOY_SUCCESS`: `true` to enable success issue creation
   - Optional context: `RENDER_SERVICE_NAME` if you want a friendly name in issues

### Required Permissions
Ensure the token (PAT) has:
- Create issues in the target repository
- Access repository metadata
- Read repository contents (for context)

Fine-grained tokens are recommended. Scope the token to the single repository and limit to the permissions above.

### Troubleshooting
- No issue created:
  - Verify `GITHUB_TOKEN` is present and valid.
  - Confirm `GITHUB_REPO` is set correctly if you changed the default.
  - Check Render logs for `[render-build]` / `[render-start]` output.
- GitHub API errors:
  - Inspect log line `[render-issue] GitHub issue creation failed:` for status and error.
  - Ensure the PAT includes Issues (Read/Write) and Metadata (Read).
- Excessive issues on success:
  - Disable `CREATE_ISSUE_ON_DEPLOY_SUCCESS` or remove it to only capture failures.

### Monitoring and Alerts
- Success/failure of the issue creation is logged to the Render service logs.
- On failure, the error status and response text are printed for triage.
- Optional: integrate external alerting (e.g., Slack webhook) by extending `scripts/render-issue.js` to post alerts when `ALERT_WEBHOOK_URL` is set.

### Security Notes
- All sensitive values are handled via environment variables in Render.
- Use fine-grained PATs restricted to the single repository.
- Review Render’s access controls and restrict who can change environment variables.
