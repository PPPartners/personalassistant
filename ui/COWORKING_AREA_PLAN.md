# Claude Code Co-Working Area - Implementation Plan

## Overview

Transform PersonalAssistant from a single Claude Code terminal integration into a multi-agent collaboration hub where you can spawn multiple Claude Code instances to work on different tasks simultaneously.

## Vision

Instead of a single terminal, have a **"Co-Workers"** view where you can:
- Spawn multiple Claude Code instances working on different tasks
- Assign tasks to agents: "Write email draft", "Research topic", "Draft agenda"
- Monitor progress with real-time status updates
- Review artifacts (drafts, summaries, documents) produced by agents
- Provide feedback for revisions or approve and use outputs
- Link agents to tasks with auto-attachment of approved artifacts

---

## Current Foundation

✅ **Terminal integration** - Claude Code running in dedicated PTY process
✅ **PTY process management** - Via Electron IPC
✅ **File watching** - App auto-reloads when Claude modifies task files
✅ **Task & artifact system** - Tasks have notes, attachments, etc.

---

## Design Decisions

### 1. Agent Workspace
**Location**: `~/PersonalAssistant/agents/workspaces/{agent-id}/`
- Each agent gets isolated subdirectory within PersonalAssistant
- Shared access to main PA data but separate working space

### 2. Artifact Types
**Start with**: Text and Markdown documents
- Emails, meeting notes, research summaries, drafts
- Future: Code, spreadsheets, images, etc.

### 3. Auto-Approval
**Smart completion**: Agents can mark if review is needed
- Research/summaries: Auto-complete without review
- Emails/important docs: Require manual approval

### 4. Persistence
**Session-only for now** (simplest approach)
- Agents stored in-memory during app session
- On restart: all agents cleared, workspaces deleted
- Can add persistence later if needed

### 5. Completion Detection
**Explicit marking**: Agents communicate status via special commands
- `claude-agent-status: completed`
- `claude-agent-artifact: artifact.md`
- `claude-agent-needs-review: true|false`

### 6. Feedback Loop
**Both automatic and manual**:
- Auto-revise: Agent automatically restarts on feedback
- Manual: User can click "Request Changes" button

---

## Architecture

### Agent Data Structure

```javascript
{
  id: "agent-uuid",
  name: "Email Drafter",
  status: "working" | "completed" | "waiting_review" | "failed",
  task: "Write email draft for Q1 roadmap update",
  createdAt: timestamp,
  linkedTaskId: "nvidia-po", // Optional
  artifact: {
    type: "markdown" | "text",
    content: "...",
    version: 2,
    feedback: ["Make it more concise", "Add timeline"]
  },
  ptyProcessId: "pty-123",
  workingDirectory: "/path/to/workspace",
  outputBuffer: [] // Terminal output lines
}
```

### Multi-PTY System

```javascript
// electron/main.js
const agentProcesses = new Map(); // agent-id -> { pty, agent, outputBuffer }
```

Each agent gets:
- Dedicated PTY process running Claude Code
- Own working directory
- Independent output buffer
- Status tracking

### Agent Communication Protocol

Agents use special markers in terminal output:
```bash
claude-agent-status: working
claude-agent-status: completed
claude-agent-artifact: /path/to/artifact.md
claude-agent-needs-review: true
```

Parser in main.js watches for these markers and triggers state changes.

---

## Implementation Phases

### Phase 1: Core Agent System (Backend) 🏗️

**1.1 Electron Backend (`electron/main.js`)**
- [ ] Add `agentProcesses` Map for multiple PTY tracking
- [ ] Create agent workspace directories on spawn
- [ ] Implement IPC handlers:
  - `spawn-agent` - Creates PTY, runs Claude Code with initial prompt
  - `get-agents` - Returns list of active agents
  - `get-agent-output` - Returns terminal buffer for specific agent
  - `send-agent-command` - Send command to agent's PTY
  - `terminate-agent` - Kill PTY, cleanup workspace
- [ ] Build status marker parser (watches PTY output for protocol markers)
- [ ] Send agent status updates to renderer via IPC events

**1.2 Preload API (`electron/preload.cjs`)**
- [ ] Add agent methods to `window.electronAPI`:
  ```javascript
  spawnAgent(task, linkedTaskId?)
  getAgents()
  getAgentOutput(agentId)
  sendAgentFeedback(agentId, feedback)
  terminateAgent(agentId)
  onAgentStatusChange(callback)
  ```

**1.3 Initial Prompt Template**
```
You are a focused AI assistant working on a specific task.

Task: {user-task}

Instructions:
1. Complete the task to the best of your ability
2. Save your final output to a file called 'artifact.md'
3. When done, type exactly: claude-agent-status: completed
4. If your work needs human review, type: claude-agent-needs-review: true
5. If your work is ready to use as-is, type: claude-agent-needs-review: false

Begin working now.
```

---

### Phase 2: UI Components 🎨

**2.1 CoWorkersView.jsx**
- [ ] Grid layout showing all active agents
- [ ] Empty state: "No agents working yet. Spawn one!"
- [ ] "+ New Agent" button in header
- [ ] Agent cards in responsive grid

**2.2 AgentCard.jsx**
- [ ] Agent name, task description, status indicator
- [ ] Preview of latest output (first 100 chars)
- [ ] Action buttons based on status:
  - Working: `[View Output] [Cancel]`
  - Waiting Review: `[Review ⭐] [Cancel]`
  - Completed: `[View Result] [Dismiss]`
- [ ] Visual states:
  - 🟢 Working (pulsing green dot)
  - ⏸️ Waiting Review (yellow dot)
  - ✅ Done (green checkmark)
  - ❌ Failed (red X)

**2.3 AgentDetailPanel.jsx**
- [ ] Slides in from right (like TaskDetailPanel)
- [ ] Three sections:
  - **Terminal Output**: Readonly scrollable terminal view
  - **Artifact**: Markdown/text renderer with syntax highlighting
  - **Feedback**: Text area + action buttons
- [ ] Version history display
- [ ] Actions: `[Approve & Use] [Request Changes] [Close]`

**2.4 SpawnAgentModal.jsx**
- [ ] Text input: "What should this agent work on?"
- [ ] Optional: Dropdown to link to existing task
- [ ] `[Cancel] [Spawn Agent]` buttons

**2.5 Update ViewNavigation.jsx**
- [ ] Add "Co-Workers 🤖" tab
- [ ] Show agent count badge when agents active
- [ ] New tab order: Today, All Tasks, Ideas, **Co-Workers**, Archive, Terminal

---

### Phase 3: Agent Lifecycle 🔄

**3.1 Spawning**
- [ ] User clicks "+ New Agent" or "Assign to Agent" from task
- [ ] Modal collects task description and optional task link
- [ ] Backend creates workspace: `~/PersonalAssistant/agents/workspaces/agent-{uuid}/`
- [ ] Spawns PTY with Claude Code in workspace directory
- [ ] Sends initial prompt with task
- [ ] Agent appears in Co-Workers view with "🟢 Working" status

**3.2 Working**
- [ ] Terminal output streamed to renderer in real-time
- [ ] Output buffer stored for playback
- [ ] Parser watches for status markers
- [ ] UI shows live output preview in card
- [ ] User can view full output in detail panel anytime

**3.3 Completion**
- [ ] Agent writes `artifact.md` and sends status marker
- [ ] Backend reads artifact file content
- [ ] Artifact sent to renderer
- [ ] If `needs-review: false` → auto-approve, attach to task, dismiss
- [ ] If `needs-review: true` → status → "⏸️ Waiting Review"

**3.4 Review & Feedback**
- [ ] User opens detail panel for waiting agent
- [ ] Reviews artifact content
- [ ] Options:
  - **Approve & Use**: Copy to clipboard, attach to linked task, dismiss agent
  - **Request Changes**: Enter feedback, send to agent
- [ ] On feedback submission:
  - Feedback sent to agent PTY
  - Status back to "🟢 Working"
  - Feedback tracked in agent history
  - Agent revises and produces new version

**3.5 Termination**
- [ ] User clicks "Cancel" or "Dismiss"
- [ ] PTY process killed gracefully
- [ ] Workspace directory cleaned up (or kept for debugging)
- [ ] Agent removed from active list

---

### Phase 4: Task Integration 🔗

**4.1 Spawn from Task**
- [ ] Add "🤖 Assign to Agent" button in TaskDetailPanel
- [ ] Button opens SpawnAgentModal pre-filled with task title
- [ ] Automatically links new agent to task

**4.2 Auto-Attach Artifacts**
- [ ] When agent completes and is approved
- [ ] If linked to task: add artifact to task notes
- [ ] Note format:
  ```markdown
  - **Agent Output** (timestamp):
    {artifact content}
  ```
  Or as attachment reference if artifact is file

**4.3 Task Status Badge**
- [ ] If task has linked agent working: show "🤖 Agent working..." badge
- [ ] Badge is clickable → jumps to agent detail view
- [ ] Update badge when agent status changes

---

### Phase 5: Polish & UX ✨

**5.1 Notifications**
- [ ] Desktop notification when agent completes (if app in background)
- [ ] Sound effect (optional, can toggle in settings)
- [ ] Badge count on Co-Workers tab

**5.2 Error Handling**
- [ ] If PTY crashes: agent status → "❌ Failed"
- [ ] Show error message in detail panel
- [ ] "Retry" button to restart agent with same task
- [ ] Timeout handling (agent taking too long)

**5.3 UX Improvements**
- [ ] Keyboard shortcuts (Cmd+Shift+A to spawn agent)
- [ ] Drag-and-drop task to Co-Workers view to spawn agent
- [ ] Bulk actions (dismiss all completed agents)
- [ ] Search/filter agents

**5.4 Agent Templates (Future)**
- [ ] Quick spawn buttons:
  - "📧 Draft Email"
  - "🔍 Research Topic"
  - "📝 Summarize Notes"
  - "📅 Create Agenda"
- [ ] Pre-configured prompts for common tasks
- [ ] Custom template creation

---

## File Structure

```
PersonalAssistant/
  agents/
    workspaces/
      agent-{uuid-1}/
        artifact.md
        ... (agent working files)
      agent-{uuid-2}/
        artifact.md
        ...

ui/
  src/
    components/
      CoWorkersView.jsx        ← NEW
      AgentCard.jsx            ← NEW
      AgentDetailPanel.jsx     ← NEW
      SpawnAgentModal.jsx      ← NEW
      ViewNavigation.jsx       ← UPDATE (add Co-Workers tab)
      TaskDetailPanel.jsx      ← UPDATE (add "Assign to Agent")

  electron/
    main.js                    ← UPDATE (multi-PTY management)
    preload.cjs                ← UPDATE (agent IPC API)
```

---

## User Workflow Example

### Scenario: Preparing for NVidia Q1 Meeting

1. **Create parent task**: "Prep for NVidia Q1 meeting"

2. **Spawn 3 agents**:
   - Agent 1: "Research NVidia's Q4 earnings and recent news"
   - Agent 2: "Draft meeting agenda with our roadmap items"
   - Agent 3: "Write email to confirm meeting time and attendees"

3. **Monitor in Co-Workers view**:
   ```
   🟢 Agent 1: Researching...
   ⏸️ Agent 2: Draft ready for review
   ✅ Agent 3: Email complete
   ```

4. **Review Agent 2's draft**:
   - Click card → view artifact
   - Feedback: "Add section about Part Analyzer demo"
   - Agent restarts, updates draft
   - Approve revised version

5. **Use outputs**:
   - Agent 1's research → attached to task notes
   - Agent 2's agenda → attached to task notes
   - Agent 3's email → copied to clipboard, sent manually

6. **Complete parent task**: All prep work done and documented

---

## Development Strategy

### MVP (Minimum Viable Product)
**Goal**: Functional multi-agent system with basic workflow

- ✅ Phase 1: Core Agent System
- ✅ Phase 2: Basic UI (view, cards, modal)
- ✅ Phase 3: Agent Lifecycle (spawn, work, review, complete)

**Stop here for initial testing and feedback**

### Full Feature
**Goal**: Production-ready with task integration

- ✅ Phase 4: Task Integration
- ✅ Phase 5: Polish & UX

### Future Enhancements
**Goal**: Advanced collaboration features

- Agent templates library
- Multi-agent collaboration (agents working together)
- Scheduled/recurring agents
- Artifact version diff viewer
- Agent cost tracking (API usage)
- Export agents as reusable workflows

---

## Technical Notes

### Session-Only Storage
- Agents exist only during app session
- In-memory storage (array/Map in main.js)
- On app restart: all cleared
- Simple, no persistence layer
- **Future**: Save to `~/PersonalAssistant/agents/agents.json` for persistence

### Claude Code Integration
- Each agent = dedicated Claude Code session
- Reuses existing PTY infrastructure from ClaudeTerminal
- Agent gets own working directory
- Prompt engineering ensures focused work

### Status Protocol
- Special markers trigger state changes
- Parser is fault-tolerant
- Non-marker output = normal terminal content
- Allows rich communication without breaking UX

### Performance Considerations
- Limit concurrent agents (e.g., max 5 at once)
- Output buffer size limit (e.g., last 10,000 lines)
- Workspace cleanup on termination
- PTY process monitoring for crashes

---

## Testing Plan

### Unit Tests
- Agent state management
- Status marker parser
- Artifact file reading
- Feedback loop

### Integration Tests
- Spawn agent → verify PTY created
- Send command → verify received
- Complete workflow → verify artifact attached

### Manual Testing Scenarios
1. Spawn 3 agents simultaneously
2. Complete one, review another, cancel third
3. Give feedback and verify revision
4. Link agent to task, verify attachment
5. Kill app mid-work, verify cleanup on restart

---

## Success Metrics

- ✅ Can spawn multiple agents concurrently
- ✅ Agents complete tasks and produce artifacts
- ✅ Review workflow works smoothly
- ✅ Feedback loop produces improved outputs
- ✅ Task integration auto-attaches artifacts
- ✅ No crashes or memory leaks with multiple agents
- ✅ User can manage 5+ agents without confusion

---

## Next Steps

1. ✅ Save this plan to `COWORKING_AREA_PLAN.md`
2. Start Phase 1: Core Agent System (backend)
3. Build Phase 2: UI Components
4. Implement Phase 3: Agent Lifecycle
5. Test MVP thoroughly
6. Iterate based on real usage
7. Add Phase 4 & 5 features

---

## Questions & Decisions Log

**Q**: Where should agents work?
**A**: `~/PersonalAssistant/agents/workspaces/{agent-id}/` - isolated but within PA

**Q**: What artifact types to support?
**A**: Start with text/markdown, expand later

**Q**: Auto-approve or always review?
**A**: Agent decides - can mark needs-review true/false

**Q**: Persist across restarts?
**A**: Session-only for simplicity, add persistence later if needed

**Q**: How to detect completion?
**A**: Agent marks explicitly via status protocol

**Q**: Auto-revise or manual?
**A**: Both - auto-revise on feedback submission, but user can also manually trigger

---

*Plan created: 2026-01-14*
*Last updated: 2026-01-14*
