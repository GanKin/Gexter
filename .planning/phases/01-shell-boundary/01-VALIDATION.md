---
phase: 1
slug: shell-boundary
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-03
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun built-in test runner |
| **Config file** | `package.json` scripts; `jest.config.js` legacy compatibility |
| **Quick run command** | `bun test src/webui/runtime-adapter.test.ts src/controllers/agent-runner.test.ts src/gateway/routing/resolve-route.test.ts` |
| **Full suite command** | `bun run typecheck && bun test` |
| **Estimated runtime** | ~60 seconds after dependencies are installed |

---

## Sampling Rate

- **After every task commit:** Run the targeted Bun test for files touched by that task.
- **After every plan wave:** Run `bun run typecheck && bun test`.
- **Before `$gsd-verify-work`:** Full suite must be green.
- **Max feedback latency:** 120 seconds after Bun and dependencies are available.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | WEB-01 | infrastructure | `bun --version && bun install` | no | pending |
| 01-01-02 | 01 | 1 | WEB-01 | smoke/unit | `bun test src/webui/runtime-adapter.test.ts` | no W0 | pending |
| 01-02-01 | 02 | 1 | WEB-02 | unit | `bun test src/webui/runtime-adapter.test.ts src/controllers/agent-runner.test.ts` | no W0 | pending |
| 01-03-01 | 03 | 2 | WEB-09 | typecheck/smoke | `bun run typecheck` | partial | pending |
| 01-03-02 | 03 | 2 | WEB-10 | typecheck/smoke | `bun run typecheck && bun test src/gateway/routing/resolve-route.test.ts src/gateway/sessions/store.test.ts` | partial | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] Bun is installed and available on `PATH`.
- [ ] `bun install` restores `node_modules`.
- [ ] `src/webui/runtime-adapter.test.ts` exists and covers `WEB-01` and `WEB-02`.
- [ ] A compatibility check covers unchanged `start`, `dev`, `gateway`, and `gateway:login` scripts in `package.json`.
- [ ] Vite and web TypeScript config compile independently from existing CLI and gateway entrypoints.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser shell opens and visibly identifies Dexter WebUI | WEB-01 | Requires browser rendering | Start the WebUI dev command and open the local URL; confirm the first screen names Dexter WebUI and reaches `/api/runtime/health`. |
| Existing CLI can still be launched | WEB-09 | Interactive Ink CLI is difficult to fully assert in unit tests | Run the existing CLI command after Phase 1 and confirm it reaches the normal startup path. |
| Existing gateway commands remain callable | WEB-10 | Gateway may require local runtime/env setup | Run existing gateway script smoke checks and confirm imports/startup path are unchanged. |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] Feedback latency < 120s after dependencies are installed.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-05-03
