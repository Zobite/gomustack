# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.0.x   | ✅ Active support  |

## Reporting a Vulnerability

If you believe you have discovered a security or privacy vulnerability in GomuStack, please report it responsibly.

### How to Report

1. **DO NOT** open a public GitHub issue for security vulnerabilities.
2. Use the [GitHub Private Vulnerability Disclosure](https://github.com/Zobite/gomustack/security/advisories/new) feature to submit your report.

### What to Include

- Specific version(s) affected
- A technical description of the vulnerability
- Steps to reproduce the issue
- Proof of concept or exploit (if available)
- Potential impact assessment

### Response Timeline

- **Acknowledgment**: Within **7 days** of submission
- **Initial Assessment**: Within **14 days** of acknowledgment
- **Fix & Disclosure**: Coordinated with the reporter

### Important Notes

- The initial acknowledgment is neither acceptance nor rejection of your report.
- We may follow up with additional questions or requests for clarification.
- We will coordinate with you on the public disclosure timeline.
- We appreciate your patience and responsible disclosure.

## Security Best Practices

When deploying GomuStack:

- **Change default credentials** immediately after installation
- Use **API keys** (`ltk_*`) instead of JWT tokens for agent access
- Bind to `127.0.0.1` (default) — only expose via reverse proxy with TLS
- Rotate API keys periodically
- Keep GomuStack updated to the latest version
