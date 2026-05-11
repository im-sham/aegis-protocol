# Aegis Access Control Baseline

Last updated: 2026-05-11
Owner: Pallas

## Purpose

Track operator access decisions for Aegis project control planes. This is an operations baseline, not a secrets inventory; do not store credentials here.

## Current GitHub state

- Repository: `im-sham/aegis-protocol`
- Visibility: public
- Current authenticated CLI account on the ThinkPad: `im-sham`
- Current repo permission for that token: admin/maintain/push/triage/pull
- Current listed collaborator set: `im-sham` only
- Token scopes observed locally: `repo`, `workflow`, `read:org`, `gist`

## GitHub Pallas/operator access decision

Decision: do not create or add a separate Pallas GitHub account yet.

Rationale:

1. The repo is currently a personal GitHub repository under `im-sham`, not an Aegis/USMI organization repository.
2. GitHub permits only real user accounts or organizations; a second "Pallas" user would be another human-style account to maintain, secure, and explain.
3. The ThinkPad already has sufficient repo/admin access for the current operating mode via `im-sham`, and all substantive changes should continue through branches and PRs so review/CI remains visible.
4. A separate Pallas GitHub identity would not unblock the current MCP.so or mcpservers.com registry submissions without interactive browser OAuth, and adding broad repo/org OAuth to third-party registries is outside the approved automation boundary.
5. The least-risk near-term posture is operational separation by workflow, not account sprawl: Pallas-authored branches, conventional commits, PRs, and documented evidence.

## Recommended future model

If Aegis moves from solo-founder repo to project/org control plane:

1. Create a dedicated GitHub organization for Aegis or USMI-controlled Aegis work.
2. Keep Sham as owner/root of trust.
3. Add Pallas as a bot/operator account only if GitHub ToS and security posture are acceptable for that account model.
4. Grant least privilege:
   - repository maintain/write for routine docs and PR work,
   - Actions/environment approval only if explicitly approved,
   - no owner/admin by default,
   - no broad third-party OAuth grants unless reviewed case-by-case.
5. Prefer GitHub App or fine-grained token automation for CI/package flows over a standing full-scope personal token.

## Current operator boundaries

- Routine docs, trackers, branches, PRs, CI inspection, package metadata checks: Pallas may proceed autonomously.
- Protected-environment approvals that consume testnet wallet/RPC resources: ask Sham unless explicitly pre-approved for that run class.
- Third-party OAuth asking for broad GitHub org/repo write permissions: ask Sham.
- Destructive repo/account actions: ask Sham.

## Next review trigger

Review this decision when one of these happens:

- Aegis GitHub organization is created.
- External registries require GitHub OAuth with repo/org write access.
- CI publishing needs a dedicated fine-grained token or GitHub App.
- Additional human/agent collaborators join the project.
