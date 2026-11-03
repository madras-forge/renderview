# Security

renderview is intended for authenticated internal use. Keep Cloud Run IAM enforcement enabled. Do not provide anonymous access to the scanning endpoint.

See the README for the threat model, resource limits, DNS-pinned egress policy, and browser isolation limitations. Browser engine vulnerabilities are outside the protections of the URL validator and proxy. Keep Playwright/Chromium and the container image updated, and use a dedicated runtime identity with no project roles.

Report vulnerabilities privately to the repository owner using GitHub's private vulnerability reporting if enabled. Do not include secrets or captured third-party HTML in public issues.
