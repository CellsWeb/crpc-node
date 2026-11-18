# Security policy

## Report privately

Please report suspected vulnerabilities through [GitHub private vulnerability
reporting](https://github.com/CellsWeb/crpc-node/security/advisories/new) when the
repository's Security tab offers **Report a vulnerability**. Availability is a
repository setting; opening a public issue is not a fallback for sensitive reports.

If the private form is unavailable, use [info@cellsweb.com](mailto:info@cellsweb.com)
or the [official contact page](https://cellsweb.com/contact) to **request a private
reporting channel**. Send only a brief nonsensitive request until a suitable
channel is confirmed. Do not post exploit details in public issues, discussions,
pull requests, logs or chat transcripts.

## What to include in a private report

- Affected repository, package/module version, runtime and operating system.
- A minimal reproducible example, prerequisites and expected/actual behavior.
- Security impact and the trust boundary crossed; identify HTTP, multipart,
  in-memory or IPC paths and whether authentication is required.
- Relevant sanitized requests/responses and the earliest known affected version.
  Use dummy credentials and files, not customer data, keys or production secrets.

Allow maintainers to reproduce and coordinate a fix before public disclosure.
Discuss disclosure timing privately; this policy does not promise an invented
acknowledgment deadline or backport schedule. Maintainers will determine affected
versions and release guidance during triage.

## Release context and responsibilities

The current released baseline is Node core 1.0.34/client 1.0.24/scaffolder 1.0.30 and
Go v1.0.1. Include the exact installed version when reporting, including older
versions if relevant. There is no published long-term-support matrix here.

Application middleware owns credential verification and authorization. Generated
auth modules are customization examples. Deprecated isPublic/IsPublic metadata
is ignored, and docs availability is globally configured. These facts do not
exclude genuine framework bypasses, data exposure or resource-exhaustion reports.

For ordinary nonsensitive bugs use the bug template. Conduct concerns follow
[the Code of Conduct](https://github.com/CellsWeb/crpc-node/blob/main/CODE_OF_CONDUCT.md).
