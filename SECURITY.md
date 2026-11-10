# Security

## IMPORTANT

We do not accept AI generated security reports. We receive a large number of
these and we absolutely do not have the resources to review them all. If you
submit one that will be an automatic ban from the project.

## Threat Model

### Overview

Loophole is an AI-powered coding assistant that runs locally on your machine. It provides an agent system with access to powerful tools including shell execution, file operations, and web access.

### No Sandbox

Loophole does **not** sandbox the agent. The permission system exists as a UX feature to help users stay aware of what actions the agent is taking - it prompts for confirmation before executing commands, writing files, etc. However, it is not designed to provide security isolation.

If you need true isolation, run Loophole inside a Docker container or VM.

### Server Mode

Server mode is opt-in only. When enabled, set `OPENCODE_SERVER_PASSWORD` to require HTTP Basic Auth. Without this, the server runs unauthenticated (with a warning). It is the end user's responsibility to secure the server - any functionality it provides is not a vulnerability.

### Out of Scope

| Category                        | Rationale                                                               |
| ------------------------------- | ----------------------------------------------------------------------- |
| **Server access when opted-in** | If you enable server mode, API access is expected behavior              |
| **Sandbox escapes**             | The permission system is not a sandbox (see above)                      |
| **LLM provider data handling**  | Data sent to your configured LLM provider is governed by their policies |
| **MCP server behavior**         | External MCP servers you configure are outside our trust boundary       |
| **Malicious config files**      | Users control their own config; modifying it is not an attack vector    |

---

# Reporting Security Issues

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in Loophole, please report it privately by:

1. Sending an email to: security@loophole.ai
2. Including details about the vulnerability
3. Providing steps to reproduce (if applicable)
4. Waiting for confirmation before publicly disclosing

You can also use the GitHub Security Advisory
["Report a Vulnerability"](https://github.com/loophole-ai/loophole-app/security/advisories/new)
tab.

We will review your report and work with you to address the issue. We aim to respond within 48 hours.

## Responsible Disclosure

We appreciate responsible security disclosures and will work with researchers to:

- Acknowledge the report
- Investigate and validate the vulnerability
- Develop and test a fix
- Release a security update
- Credit the reporter (if desired)

## Escalation

If you do not receive an acknowledgement of your report within 6 business days, you may send a follow-up email to security@loophole.ai.
