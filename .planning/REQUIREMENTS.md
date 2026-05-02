# Requirements: Dexter WebUI

**Defined:** 2026-05-03
**Core Value:** 把 Dexter 的现有能力安全地暴露成一个好用的 Web 入口，同时不破坏已经成熟的核心引擎。

## v1 Requirements

### Browser Shell

- [ ] **WEB-01**: User can open a browser-based Dexter workspace connected to a local Dexter runtime.
- [ ] **WEB-02**: User can start a new session from the webui without changing Dexter core code paths.

### Conversation

- [ ] **WEB-03**: User can send a prompt and receive streamed assistant output in the browser.
- [ ] **WEB-04**: User can see tool calls, approvals, and intermediate agent state during a run.
- [ ] **WEB-05**: User can stop, retry, or continue an in-flight run from the webui.

### Sessions and Settings

- [ ] **WEB-06**: User can reopen prior sessions and keep them separate.
- [ ] **WEB-07**: User can choose the active model/provider for a session in the webui.
- [ ] **WEB-08**: User can save UI preferences locally.

### Compatibility

- [ ] **WEB-09**: Existing Dexter CLI usage continues to work after the webui is added.
- [ ] **WEB-10**: Existing gateway/background features continue to work after the webui is added.

### Experience

- [ ] **WEB-11**: User can use the webui comfortably on desktop and mobile browsers.
- [ ] **WEB-12**: User can complete the primary chat flow with keyboard-only interaction.

## v2 Requirements

### Remote Access

- **WEB-13**: User can sign in to a hosted deployment.
- **WEB-14**: User can access the same workspace from multiple devices.

### Collaboration

- **WEB-15**: Multiple users can share a workspace and conversation history.
- **WEB-16**: Users can leave comments or handoff notes on runs.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Rewriting the Dexter core architecture | The product goal is to wrap the existing engine, not replace it |
| Replacing the CLI | CLI must remain a supported path alongside the webui |
| Public SaaS authentication by default | Adds backend and permissions complexity that is outside v1 |
| New financial data capabilities | The wrapper should expose Dexter, not expand its domain |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WEB-01 | Phase 1 | Pending |
| WEB-02 | Phase 1 | Pending |
| WEB-03 | Phase 2 | Pending |
| WEB-04 | Phase 3 | Pending |
| WEB-05 | Phase 3 | Pending |
| WEB-06 | Phase 4 | Pending |
| WEB-07 | Phase 3 | Pending |
| WEB-08 | Phase 4 | Pending |
| WEB-09 | Phase 1 | Pending |
| WEB-10 | Phase 1 | Pending |
| WEB-11 | Phase 5 | Pending |
| WEB-12 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-05-03*
*Last updated: 2026-05-03 after new-project initialization*
