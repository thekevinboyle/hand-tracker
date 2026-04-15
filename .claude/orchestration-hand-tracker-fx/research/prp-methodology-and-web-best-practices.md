# PRP Methodology and Web Best Practices - Research

**Wave**: First
**Researcher**: Web Research Specialist subagent
**Date**: 2026-04-14
**Status**: Complete

---

## Summary

Rasmus Widing (GitHub: Wirasm) is an AI agent specialist based in Tallinn, Estonia who created the PRP (Product Requirements Prompt) framework — a structured prompt methodology for giving AI coding agents the exact context they need to ship production-ready code in one pass. The framework (2,131 GitHub stars, 605 forks as of April 2026, actively updated) defines a PRP as "PRD + curated codebase intelligence + agent/runbook" and is organized around four pillars: comprehensive context, precise implementation blueprints, executable validation loops, and the autonomous Ralph loop for self-healing iteration. Modern web best practices for 2026 add hard requirements around Core Web Vitals budgets, WCAG 2.2 AA, HTTPS-gated webcam access, Permissions-Policy headers, CSP Level 3, and graceful permission UX state machines — all of which must be encoded into task files and validation loops for a webcam-based hand tracker app.

---

## Key Findings

### Who is Rasmus Widing

- **GitHub**: https://github.com/Wirasm (handle: Wirasm)
- **YouTube**: https://youtube.com/@rasmuswiding
- **LinkedIn**: https://www.linkedin.com/in/rasmuswiding/
- **Website**: https://rasmuswiding.com
- **Location**: Tallinn, Estonia
- **Background**: 3 years building with AI agents; focuses on practical patterns over theory. Collaborators include Cursor, Proekspert, and StartGuides.
- **Teaching format**: Half-day (AI Operations for non-technical) and full-day (AI Coding) workshops for engineering teams of 5–15; participants leave with working CLAUDE.md files, PRP templates, and at least one functioning agent.

**Primary repo**: https://github.com/Wirasm/PRPs-agentic-eng
- 2,131 stars, 605 forks
- Last updated: 2026-04-14 (current as of this research)
- Contains: 28+ Claude Code slash commands, PRP templates, agents, skills, hooks, plugin system

---

### What is PRP — Definition and Core Equation

> "PRP = PRD + curated codebase intelligence + agent/runbook"
> — Wirasm CLAUDE.md

A PRP is the **minimum viable context packet** an AI agent needs to implement working, production-ready code in a single pass.

**How it differs from a traditional PRD:**

| Dimension | Traditional PRD | PRP |
|-----------|-----------------|-----|
| Focus | What + Why | What + Why + **How** |
| File references | None | Exact file paths with line numbers |
| Library context | None | Versions pinned, doc URLs with anchors |
| Code examples | None | Actual copy-pasted codebase snippets |
| Verification | Out of scope | Executable validation commands included |
| Agent patterns | None | ReAct, Plan-and-Execute, sub-agent use |
| Self-healing | None | Validation loop + Ralph loop until green |

**Core equation from the README:**
> "A PRP keeps the goal and justification sections of a PRD yet adds AI-critical layers: Context (precise file paths, library versions, code snippet examples), Patterns (existing codebase conventions to follow), Validation (executable commands the AI can run to verify its work)."

---

### PRP File Format — Canonical Sections

The canonical PRP template (`old-prp-commands/PRPs/templates/prp_base.md`) defines these sections in order:

1. **Goal** — specific, measurable end state; deliverable artifact; success definition
2. **User Persona** (if applicable) — target user, use case, user journey, pain points
3. **Why** — business value, user impact, integration with existing features
4. **What** — user-visible behavior, technical requirements, success criteria checklist
5. **All Needed Context** — the heaviest section; includes:
   - Context Completeness Check ("If someone knew nothing about this codebase, would they have everything needed?")
   - Documentation and References (YAML block with `url:`, `why:`, `critical:`, `file:`, `pattern:`, `gotcha:`, `docfile:`)
   - Current codebase tree (`tree` output)
   - Desired codebase tree with new files and their responsibilities
   - Known Gotchas and Library Quirks (code comments with `# CRITICAL:` prefixes)
6. **Implementation Blueprint** — data models; ordered implementation tasks (YAML format with `Task N: CREATE/MODIFY <file>`, `IMPLEMENT:`, `FOLLOW pattern:`, `NAMING:`, `DEPENDENCIES:`, `PLACEMENT:`); integration points
7. **Validation Loop** — four levels (see detail below)
8. **Final Validation Checklist** — Technical, Feature, Code Quality, Documentation checkboxes
9. **Anti-Patterns to Avoid** — explicit `❌ Don't...` list

The newer `prp-plan.md` command output adds: **Mandatory Reading** table, **Patterns to Mirror** (with actual code snippets), **Files to Change** table, **NOT Building** scope limits, **Step-by-Step Tasks**, **Testing Strategy**, **Risks and Mitigations**, and **Acceptance Criteria**.

---

### The Four-Level Validation Loop

Every PRP must include a Validation Loop section with four progressive levels, each with **executable bash commands**:

```
Level 1: Syntax & Style (Immediate Feedback)
  - Run after EVERY file creation before proceeding
  - ruff check --fix / eslint --fix / mypy
  - Expected: Zero errors

Level 2: Unit Tests (Component Validation)
  - pytest / jest / vitest for new components
  - Coverage target: >= 80%

Level 3: Integration Testing (System Validation)
  - Start server, hit endpoints with curl
  - Verify connections (DB, services)
  - Expected: All integrations working

Level 4: Creative & Domain-Specific Validation
  - Playwright MCP browser tests
  - Performance benchmarks
  - Security scans (bandit for Python)
  - Domain-specific checks
```

**Golden Rule** (from `prp-implement.md`): "If a validation fails, fix it before moving on. Never accumulate broken state."

---

### The Ralph Loop — Autonomous Self-Healing

Named after Geoffrey Huntley's "Ralph Wiggum technique" (https://ghuntley.com/ralph/), the Ralph loop is a self-referential feedback mechanism:

**How it works:**
1. Agent implements plan tasks
2. Runs ALL validation commands from the plan
3. If any validation fails → fixes and re-validates automatically
4. Loop continues until ALL validations pass OR max-iterations reached
5. Outputs `<promise>COMPLETE</promise>` and exits

**State tracking:** `.claude/prp-ralph.state.md` — persists across iterations; stores codebase patterns discovered, per-iteration progress logs, next steps

**Stop hook** in `.claude/settings.local.json`:
```json
{
  "hooks": {
    "Stop": [{ "hooks": [{ "type": "command", "command": ".claude/hooks/prp-ralph-stop.sh" }] }]
  }
}
```

**Key behavioral rules for Ralph (from `prp-ralph-loop` SKILL.md):**
- Read state file and plan FIRST every iteration — never start blind
- Check "Codebase Patterns" section before implementing — learn from previous iterations
- Run ALL four validation levels every iteration — never skip
- Output `<promise>COMPLETE</promise>` ONLY when every validation exits 0
- NEVER lie to exit — loop continues until genuinely complete
- Log learnings after every iteration; consolidate reusable patterns to top of state file
- Archive completed runs to `.claude/PRPs/ralph-archives/YYYY-MM-DD-feature-name/`

**Max iterations:** Default 20, always set explicitly via `--max-iterations N`

---

### The Full PRP Workflow (PRD → Plan → Implement → Ralph)

```
/prp-prd "feature description"
    → Creates PRD with Implementation Phases table (columns: #, Phase, Status, PRD Plan)

/prp-plan path/to/prd.md
    → Selects next pending phase with satisfied dependencies
    → Launches prp-core:codebase-explorer + prp-core:codebase-analyst agents in PARALLEL
    → Then launches prp-core:web-researcher agent
    → Creates .claude/PRPs/plans/feature-name.plan.md
    → Updates PRD phase status to "in-progress"

/prp-implement .claude/PRPs/plans/feature-name.plan.md
    → 6-phase execution: DETECT → LOAD → PREPARE → EXECUTE → VALIDATE → REPORT
    → Detects package manager and base branch automatically
    → Runs validation after EVERY file change
    → Creates implementation report; archives plan to completed/

/prp-ralph .claude/PRPs/plans/feature-name.plan.md --max-iterations 20
    → Autonomous loop variant; continues until all validations pass
```

---

### Context Engineering Principles (Widing's Core Doctrine)

From CLAUDE.md and workshop materials:

1. **Context is King** — "Include ALL necessary documentation, examples, and caveats. The PRP must be comprehensive and self-contained."
2. **Information Dense** — Use keywords and patterns from the actual codebase; never generic descriptions
3. **Codebase First, Research Second** — Explore the real codebase with agents before searching external docs; solutions must fit existing patterns
4. **Pattern Faithfulness** — Every new file mirrors existing codebase style exactly (naming, error handling, logging, tests)
5. **Progressive Success** — Start simple, validate, then enhance; one atomic task at a time
6. **No Prior Knowledge Test** — "Could an agent unfamiliar with this codebase implement using ONLY the plan?" — If yes, the PRP is ready.
7. **Three-layer context model:**
   - Project-level: CLAUDE.md files
   - Task-level: PRP documents
   - Feedback-level: Validation loops and Ralph state

---

### CLAUDE.md Best Practices (from repo examples)

From `claude_md_files/` and the project's own CLAUDE.md:

- Define the project nature clearly at the top
- State the core architecture equation (e.g., "PRP = PRD + codebase intelligence + agent/runbook")
- List all commands available with descriptions
- Define Critical Success Patterns with concrete rules
- List Anti-Patterns to Avoid explicitly
- Include the project tree structure
- Reference skill files with `@skillname` syntax
- Update with patterns discovered during Ralph runs (permanent project knowledge)

---

### Slash Command / Skill Integration Pattern

Commands live in `.claude/commands/<category>/<name>.md`

Each command file uses frontmatter:
```markdown
---
description: <one-line description>
argument-hint: <path/to/plan.md> [--option value]
---
```

Skills live in `.claude/skills/<name>/SKILL.md` and are read by agents when executing tasks in that domain.

The plugin system (`.claude-plugin/`) packages commands, agents, skills, and hooks together for distribution.

---

### Web Best Practices for a 2026 Webcam App

#### Performance Budgets and Core Web Vitals

| Metric | 2026 Target |
|--------|-------------|
| LCP (Largest Contentful Paint) | ≤ 2.5 s |
| INP (Interaction to Next Paint) | ≤ 200 ms (p75) |
| CLS (Cumulative Layout Shift) | ≤ 0.1 |
| JS bundle (gzipped) | ≤ 400 KB interactive pages |
| TTFB (global, edge deployment) | < 50 ms |

**For a real-time webcam/canvas app:**
- Keep ML inference off the main thread (Web Workers or WebAssembly)
- Canvas rendering should not block React state updates
- Target 30–60 fps for hand tracking without jank (monitor with `requestAnimationFrame`)
- Use `OffscreenCanvas` for worker-side rendering where supported

#### Security Requirements

**Mandatory for getUserMedia to work:**
- HTTPS in production (or localhost/127.0.0.1 in development) — hard browser requirement
- Secure context check: `window.isSecureContext === true` — validate before calling API

**Headers to set in production (Next.js `next.config.js` headers or middleware):**
```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{nonce}'; style-src 'self' 'unsafe-inline'; media-src 'self' blob:; connect-src 'self'; img-src 'self' data: blob:; worker-src 'self' blob:
Permissions-Policy: camera=(self), microphone=()
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

**CSP key directives for webcam apps:**
- `media-src 'self' blob:` — required for `srcObject` streams and blob URLs
- `worker-src 'self' blob:` — required for Web Workers (e.g., MediaPipe/TensorFlow.js workers)
- `script-src` — avoid `'unsafe-eval'`; if MediaPipe requires eval, use `'wasm-unsafe-eval'` instead
- No inline scripts; use nonces for any required inline code

**Permissions-Policy camera directive:**
```http
Permissions-Policy: camera=(self)
```
- Default allowlist is already `self`; explicitly set it to be declarative
- If embedding in iframes, add origin: `camera=(self "https://trusted.example.com")`
- Blocking camera returns `NotAllowedError` from `getUserMedia()` — must be caught

#### Webcam Permission UX State Machine

Four required UI states (from Glimpse/mic-check pattern):

```
State 1: PROMPT — explain why camera is needed before triggering getUserMedia
  → User clicks "Enable Camera" button → triggers getUserMedia()

State 2: GRANTED — stream active, show video feed

State 3: SYSTEM_DENIED — OS-level block (macOS System Preferences / Windows Settings)
  → Deep-link to OS settings when possible
  → Show: "Your browser doesn't have camera access. Open System Settings > Privacy > Camera"

State 4: USER_DENIED — user clicked "Block" in browser prompt
  → Show: "You blocked camera access. Click the camera icon in your address bar to allow."
  → Browser-specific instructions (Chrome vs Safari vs Firefox differ)

State 5: DEVICE_CONFLICT — NotReadableError — camera in use by another app
  → Show: "Camera is in use by another app. Close Zoom/Teams/etc. and try again."

State 6: NOT_FOUND — no camera device
  → Show: "No camera found. Connect a webcam and refresh."
```

**UX rules:**
- Never trigger `getUserMedia()` on page load — wait for explicit user action
- Always explain WHY camera is needed before the browser prompt fires
- Handle all error types: `NotFoundError`, `NotReadableError`, `NotAllowedError`, `OverconstrainedError`
- Call `track.stop()` on ALL tracks when component unmounts (React cleanup)
- Listen to `navigator.mediaDevices.ondevicechange` for hot-plug/unplug
- After permission grant, call `enumerateDevices()` to let user pick device

**Browser compatibility notes (2026):**
- `getUserMedia()` core API: supported Chrome, Firefox, Safari, Edge, Brave, Opera
- Permissions API (query camera state without prompting): NOT supported in Safari — always fall back to `getUserMedia()` try/catch
- `OverconstrainedError` behavior differs across browsers — always have fallback constraints
- Safari is least persistent with permission caching — users may be re-prompted more often

#### Accessibility (WCAG 2.2 AA — Legally Required in EU from June 2026)

| Requirement | Standard |
|-------------|----------|
| Click target size | ≥ 24×24 px |
| Color contrast (body text) | ≥ 4.5:1 |
| Focus indicator | ≥ 3:1 contrast ratio, ≥ 2 px outline |
| Keyboard navigation | All interactive elements reachable |
| ARIA labels | Required on dynamic/interactive components |
| Screen reader | NVDA + VoiceOver tested |
| Heading hierarchy | Logical, sequential order |

For webcam/canvas apps specifically:
- Provide text alternatives for visual hand-tracking feedback
- Announce state changes (permission granted, tracking started) via ARIA live regions
- Ensure all controls are keyboard-accessible (not just mouse-operated)

#### Error Handling Patterns

- Never catch all exceptions generically — be specific by error type
- Every async operation needs a loading, success, and error state
- Use Zod or equivalent for runtime validation at API/data boundaries
- Webcam errors must produce actionable user messages, not raw DOMException text
- Log errors to observability (Sentry) from sprint 1

#### TypeScript and Code Quality

- `strict: true` in tsconfig — mandatory
- `noImplicitAny: true`
- No `any` types permitted
- Runtime validation at all external data boundaries

---

## Recommended Approach

Based on research, the recommended approach for applying PRP methodology to this project is:

1. Each task file must include a **Validation Loop section** with four levels of runnable bash/playwright commands that exit 0 when passing
2. Each task file must include a **Context section** with exact file paths, library versions pinned to package.json, and copy-pasted code snippets from the actual codebase
3. Plans must be generated by agents that first explore the codebase, THEN search external docs — never the reverse
4. The Ralph loop should be configured from day one with the stop hook in `settings.local.json`
5. Webcam permission handling must implement the full 6-state UX machine as a testable requirement, not an afterthought
6. HTTPS must be enforced in all non-localhost environments before any camera API calls
7. CSP headers with `media-src 'self' blob:` and `worker-src 'self' blob:` must be a task deliverable, not optional

---

## Actionable Directives for PHASES.md, Task Files, and Skills

These are the concrete rules derived from PRP methodology and 2026 web best practices that MUST be encoded into this project's planning artifacts:

### PRP Structure Directives

**D1: Every task file must have a Validation Loop section.**
It must contain numbered levels (1: lint/typecheck, 2: unit tests, 3: integration/browser) with exact runnable commands using the project's actual package manager. No placeholder commands.

**D2: Every task file must include a Context section with exact file references.**
Format: `file: src/path/to/pattern.tsx` + `why: what pattern to extract` + `gotcha: known constraints`. Never describe context in prose without a file path.

**D3: Every task file must include a "NOT Building" scope boundary.**
Explicitly list what is out of scope for this task to prevent scope creep during autonomous execution.

**D4: Task implementation order must be topologically sorted by dependency.**
Tasks must be executable top-to-bottom without requiring knowledge from later tasks. Identify and document dependency arrows.

**D5: Each task must specify a MIRROR pattern — an existing file to copy structure from.**
Format: `MIRROR: src/components/ExistingComponent.tsx lines 10-40`. If no existing file exists yet, specify the pattern from a framework template or the first task in the chain.

**D6: The "No Prior Knowledge Test" must pass before finalizing any task file.**
Before marking a task file complete, verify: could an agent with zero project context implement this task using only the task file?

**D7: PRPs must specify the exact package manager runner.**
Detect from lockfile: `bun.lockb` → bun, `pnpm-lock.yaml` → pnpm, `package-lock.json` → npm, `pyproject.toml` → uv. Never hardcode npm if the project uses bun.

### Ralph Loop Directives

**D8: Configure the Ralph stop hook before phase 1 begins.**
Add to `.claude/settings.local.json`:
```json
{ "hooks": { "Stop": [{ "hooks": [{ "type": "command", "command": ".claude/hooks/prp-ralph-stop.sh" }] }] } }
```

**D9: All plans must have an explicit `--max-iterations` value.**
Default 20. Reduce to 10 for simple tasks, increase to 30 for complex integration tasks.

**D10: The completion promise `<promise>COMPLETE</promise>` must only be output when ALL validation levels pass.**
Never emit it to exit early. The Ralph loop is trust-based — lying breaks the mechanism.

**D11: Each Ralph iteration must append a structured progress log entry.**
Format: Iteration N, timestamp, completed tasks, validation status per level, learnings, next steps. These are how future iterations build on past work.

### Context Engineering Directives

**D12: CLAUDE.md must define the project's Tech Stack table.**
Include exact versions for every dependency. This becomes the version-pinning reference for all PRP context sections.

**D13: Skill files must be written before tasks that use them.**
Never reference a skill in a task file if the skill doesn't exist yet. If needed, add a pre-task to create the skill.

**D14: Codebase exploration must precede external documentation research.**
When generating plans, always dispatch codebase-explorer and codebase-analyst agents first (in parallel), then the web-researcher agent second.

**D15: Patterns discovered during Ralph runs must feed back to CLAUDE.md.**
Permanent patterns (not iteration-specific) get added to a "Patterns Discovered" section in CLAUDE.md after each Ralph completion.

### Webcam / Browser API Directives

**D16: getUserMedia must NEVER be called on page load.**
It must be triggered by explicit user action after the app has explained why camera access is needed. This is a UX and browser best practice.

**D17: All six webcam permission states must be handled with distinct UI.**
States: PROMPT, GRANTED, SYSTEM_DENIED, USER_DENIED, DEVICE_CONFLICT, NOT_FOUND. Each needs its own UI message and recovery instruction.

**D18: `track.stop()` must be called on ALL MediaStreamTracks on component unmount.**
This is a React cleanup requirement. Include it in the validation checklist for every task involving webcam streams.

**D19: HTTPS / secure context must be validated before any camera API call.**
Check `window.isSecureContext` and surface a clear error if false. Include this check in the app initialization task.

**D20: CSP headers with `media-src 'self' blob:` must be set before webcam tasks are marked complete.**
Without it, `srcObject` assignment to a video element may be blocked by the browser. Add to `next.config.js` headers.

**D21: `Permissions-Policy: camera=(self)` must be set explicitly.**
Prevents camera access in cross-origin iframes and signals intentionality.

### Performance and Quality Directives

**D22: Performance budgets must be in the acceptance criteria of the initial scaffold task.**
Targets: LCP ≤ 2.5s, INP ≤ 200ms, JS bundle ≤ 400 KB gzipped, CLS ≤ 0.1.

**D23: ML inference code must not run on the main thread.**
MediaPipe/TF.js inference goes in a Web Worker or is run via `requestAnimationFrame` scheduling. Include this as a non-functional requirement in the hand tracking task.

**D24: WCAG 2.2 AA compliance must be a validation criterion for every UI task.**
At minimum: 24×24px touch targets, 4.5:1 contrast ratio, keyboard navigation, ARIA live regions for state changes.

**D25: TypeScript `strict: true` must be set in tsconfig before any code is written.**
It is easier to enforce from the start than to retrofit. Add to the scaffold task's validation checklist.

---

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Standard PRD only | Simple, familiar | No validation loops, no agent context, requires multiple clarifying passes | Rejected |
| PRP without Ralph loop | Lighter weight | No self-healing; manual iteration required | Partial (use for simple tasks, Ralph for complex) |
| PRP with full validation loops | One-pass success rate high | Requires upfront investment in task file writing | Recommended |
| Generic task list (no patterns/mirrors) | Fast to write | Agent invents patterns, creates inconsistency | Rejected |
| Request camera on page load | Simpler code | Users block it; kills the app on first visit | Rejected |
| getUserMedia without error state machine | Less code | Broken UX for 20%+ of users on first visit | Rejected |

---

## Pitfalls and Edge Cases

- **Safari Permissions API gap**: Safari does not support `navigator.permissions.query({name:'camera'})` — always use try/catch on `getUserMedia()` directly; never assume query support
- **macOS OS-level permission**: Users may allow the browser permission but have OS-level camera block — produce a distinct error message for `NotAllowedError` that distinguishes OS vs user denial
- **Wasm + CSP conflict**: Some ML libraries (MediaPipe, TF.js WASM backend) require `'wasm-unsafe-eval'` in `script-src` — use `'wasm-unsafe-eval'` not `'unsafe-eval'`; validate this in the CSP task
- **blob: in worker-src**: TF.js and MediaPipe may spawn workers from blob URLs — `worker-src 'self' blob:` is required
- **Camera constraints overshoot**: Asking for `{width: 1920, height: 1080}` on a low-end device causes `OverconstrainedError` — always provide fallback constraints or use `ideal:` instead of exact values
- **Track not stopped on route change**: In Next.js apps with client-side routing, `video.srcObject` streams persist across route changes unless explicitly stopped in `useEffect` cleanup — always include cleanup in validation checklist
- **Next.js RSC boundary**: `getUserMedia` is a browser API — components using it must be marked `"use client"` and must never run in SSR context
- **Ralph max-iterations**: Setting too low (< 10) on complex tasks causes incomplete implementations with no error signal to the user — always use ≥ 15 for tasks involving external APIs or media streams
- **Validation command placeholders**: The biggest failure mode for PRPs is validation commands left as `{runner} run test` — always resolve the actual command from the project's package.json before finalizing a task file

---

## References

- https://github.com/Wirasm/PRPs-agentic-eng — Primary source; PRP framework repo (2,131 stars, updated 2026-04-14)
- https://rasmuswiding.com — Rasmus Widing's consultancy site; workshop descriptions
- https://rasmuswiding.com/services/workshops/ — Workshop curriculum details
- https://abvijaykumar.medium.com/context-engineering-2-2-product-requirements-prompts-46e6ed0aa0d1 — PRP context engineering deep dive
- https://ghuntley.com/ralph/ — Original Ralph Wiggum technique (source of Ralph loop concept)
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/camera — Permissions-Policy camera directive
- https://web.dev/articles/csp — CSP best practices
- https://blog.addpipe.com/getusermedia-getting-started/ — getUserMedia practical 2026 guide
- https://medium.com/joinglimpse/how-to-build-beautiful-camera-microphone-permission-checking-for-websites-e6a08415fa76 — Camera permission UX state machine
- https://pagepro.co/blog/web-development-best-practices/ — 2026 web dev best practices (performance, security, a11y)
- https://content-security-policy.com/ — CSP header quick reference

---

## Second Wave Additions (if applicable)

### Implementation Details (filtered by DISCOVERY.md)

**PRP slash commands to install in this project's `.claude/commands/`:**

The following commands from Wirasm/PRPs-agentic-eng should be copied to this project (or installed via the plugin system):

```bash
# Core workflow
.claude/commands/prp-core/prp-prd.md
.claude/commands/prp-core/prp-plan.md
.claude/commands/prp-core/prp-implement.md
.claude/commands/prp-core/prp-ralph.md
.claude/commands/prp-core/prp-ralph-cancel.md
.claude/commands/prp-core/prp-debug.md
.claude/commands/prp-core/prp-commit.md
.claude/commands/prp-core/prp-pr.md
.claude/commands/prp-core/prp-review.md
```

**Stop hook to configure:**
`.claude/settings.local.json` must include the Ralph stop hook before running any Ralph loops.

**Recommended PRD → Phase → Plan → Ralph cycle for this project:**
- Use `/prp-prd` to generate a PRD for the hand tracker
- Use `/prp-plan` per phase to generate task-level plan files
- Use `/prp-ralph` with `--max-iterations 20` for complex phases (ML integration, camera setup)
- Use `/prp-implement` for simple phases (scaffold, config)

### Tool and MCP Configuration

| Tool/Service | Purpose | Setup Required | Agent Can Self-Configure? |
|-------------|---------|----------------|---------------------------|
| Playwright MCP | Browser E2E testing (Level 4 validation) | Already configured per CLAUDE.md | Yes |
| context7 | Library documentation lookup during planning | Already configured per CLAUDE.md | Yes |
| Ralph stop hook | Autonomous loop termination detection | Add to settings.local.json | Yes (agent can write the file) |

### Testing Strategy

For a webcam hand tracker, validation at each level should include:

- **Level 1 (static)**: `npx tsc --noEmit && npx eslint src/ --max-warnings 0`
- **Level 2 (unit)**: Camera permission state machine tests (mock getUserMedia); hand detection mock tests
- **Level 3 (integration)**: Playwright MCP — navigate to localhost, check video element presence, verify permission modal renders
- **Level 4 (browser/device)**: Playwright MCP — grant camera permission, verify video stream active, verify canvas overlay renders, verify FPS counter if present

Test assets needed:
- Mock `getUserMedia` implementation returning a synthetic MediaStream
- Fixture video file for offline hand-detection testing
- Mock hand landmark data for rendering tests

User flows to verify:
1. First visit → permission prompt appears → user grants → video stream starts
2. First visit → user denies → denial state UI appears with recovery instructions
3. Camera in use by another app → conflict state UI appears
4. User grants permission → hand detected → visual feedback renders

### Human Actions Required

| Action | Who | How | Status |
|--------|-----|-----|--------|
| Copy/install PRP commands from Wirasm repo | Agent | `cp -r` from cloned repo or via plugin | Pending |
| Configure Ralph stop hook in settings.local.json | Agent | Write JSON config | Pending |
| Test on macOS with OS-level camera permission blocked | User | System Prefs > Privacy > Camera | Pending |
| Verify CSP headers in production build | Agent (Playwright) | Navigate to deployed URL, check response headers | Pending |
