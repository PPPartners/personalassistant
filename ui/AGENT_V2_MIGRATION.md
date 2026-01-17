# Agent System V2 - Migration Guide

## Overview

The agent system has been completely rebuilt from the ground up to eliminate the brittle PTY/terminal scraping approach. The new V2 architecture uses the Anthropic Claude API directly for robust, structured communication.

## What Changed

### Old Architecture (V1)
- Used `claude code` CLI via PTY (pseudo-terminal)
- Scraped ANSI terminal output to detect questions
- Parsed text to identify tool calls and completion
- Sent text input via terminal (unreliable)
- Many race conditions and false positives

### New Architecture (V2)
- Direct Anthropic Claude API integration via `@anthropic-ai/sdk`
- Structured tool definitions with JSON schemas
- Clean human-in-the-loop via `stop_reason: tool_use`
- Conversation history as state machine
- No terminal scraping, no ANSI parsing

## Key Components

### 1. AgentManagerV2 (`electron/agent-manager-v2.js`)
Core agent orchestration using Claude API:
- `getToolDefinitions()`: Defines available tools (write_file, read_file, list_files, mark_complete)
- `createAgent(task, linkedTaskId)`: Spawns new agent with isolated workspace
- `continueConversation(agentId)`: Sends messages to Claude and handles responses
- `approveTool(agentId)`: Executes approved tool and continues conversation
- `rejectTool(agentId, reason)`: Rejects tool with feedback and continues

### 2. Main Process (`electron/main-v2.js`)
Integrates AgentManagerV2 with Electron:
- Initializes AgentManagerV2 with API key from environment
- Provides IPC handlers for UI communication
- Preserves all existing functionality (file system, terminal, auto-update)

### 3. Preload Bridge (`electron/preload.cjs`)
Exposes V2 methods to renderer:
- `spawnAgent(task, linkedTaskId)`: Create agent
- `getAgents()`: List all agents
- `approveTool(agentId)`: Approve pending tool
- `rejectTool(agentId, reason)`: Reject pending tool
- `getAgentArtifact(agentId)`: Get artifact.md content
- `onAgentStatusChanged(callback)`: Agent state updates
- `onAgentNeedsToolApproval(callback)`: Tool approval requests

### 4. UI Components
Updated for V2 workflow:
- **CoWorkersView**: Listens for tool approval events
- **AgentDetailPanel**: Shows tool approval UI instead of terminal input
  - Displays pending tool name and parameters
  - Approve/Reject buttons with optional rejection reason
  - Shows artifact in markdown
  - No more terminal output tab

## Agent State Machine

```
initializing
    ↓
working (sending messages to Claude)
    ↓
waiting_for_tool_approval (human reviews tool request)
    ↓ (approved)
working (tool executed, results sent back to Claude)
    ↓ (rejected)
working (rejection reason sent to Claude)
    ↓ (mark_complete tool called)
waiting_for_completion_review
    ↓
completed
```

## Tool Definitions

### write_file
Write content to a file in the agent workspace.
```json
{
  "filename": "artifact.md",
  "content": "# My Output\n..."
}
```

### read_file
Read content from a file in the agent workspace.
```json
{
  "filename": "artifact.md"
}
```

### list_files
List all files in the agent workspace.
```json
{}
```

### mark_complete
Mark the task as complete.
```json
{
  "needs_review": true,
  "summary": "Created a draft email for the client meeting"
}
```

## Setup Instructions

### 1. Set API Key
Create a `.env` file in the `ui/` directory:
```bash
ANTHROPIC_API_KEY=your_api_key_here
```

Or set it in your shell:
```bash
export ANTHROPIC_API_KEY=your_api_key_here
```

### 2. Run the App
```bash
cd ui
npm run electron:dev
```

### 3. Spawn an Agent
1. Navigate to "Co-Workers" view
2. Click "New Agent"
3. Enter a task description
4. Agent starts working automatically

### 4. Approve/Reject Tools
When the agent requests a tool:
1. Agent state changes to "Needs Approval"
2. Detail panel shows tool name and parameters
3. Click "Approve" to execute or "Reject" to deny
4. If rejected, provide a reason
5. Agent continues based on your decision

## File Structure

```
ui/
├── electron/
│   ├── agent-manager-v2.js     # Core V2 agent manager
│   ├── main-v2.js              # Main process with V2 integration
│   ├── main.js                 # Old V1 (kept for reference)
│   └── preload.cjs             # Updated IPC bridge
├── src/
│   └── components/
│       ├── CoWorkersView.jsx   # Updated for V2 events
│       └── AgentDetailPanel.jsx # Updated for tool approvals
├── .env.example                # API key template
└── package.json                # Updated to use main-v2.js
```

## Benefits of V2

1. **Reliability**: No more terminal scraping, ANSI parsing, or race conditions
2. **Transparency**: Structured tool calls with clear parameters
3. **Control**: Explicit human approval for every action
4. **Debugging**: Conversation history provides full context
5. **Scalability**: Easy to add new tools with JSON schemas
6. **Performance**: Direct API calls, no subprocess overhead

## Migration Checklist

- [x] Install @anthropic-ai/sdk dependency
- [x] Create AgentManagerV2 with Claude API integration
- [x] Define tool schemas for file operations
- [x] Implement conversation state management
- [x] Update IPC handlers for new architecture
- [x] Build tool approval flow in UI
- [x] Update UI components for V2
- [ ] Set ANTHROPIC_API_KEY (user action required)
- [ ] Test end-to-end workflow
- [ ] Remove old V1 code after validation

## Next Steps

1. Test the system by spawning an agent
2. Verify tool approval workflow
3. Check artifact generation
4. Test completion flow
5. Once validated, remove old V1 files (main.js, agent-manager.js)

## Troubleshooting

**Agent manager not initialized**
- Check that ANTHROPIC_API_KEY is set in environment
- Restart Electron app after setting the key

**Agent stuck in "working" state**
- Check console logs for API errors
- Verify API key is valid
- Check network connectivity

**Tool approval not showing**
- Check that onAgentNeedsToolApproval listener is registered
- Verify agent.pendingToolUse exists in state
- Check console for event logs
