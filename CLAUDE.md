# CLAUDE.md

This file instructs Claude Code on how to work inside the **PersonalAssistant** project.

---

## Project Overview

The PersonalAssistant project helps Stefan track tasks, notes, ideas, and context.  
Claude Code manages files inside this folder, updates tasks, adds notes, moves items between lists, and keeps the structure consistent.  
Stefan interacts by writing natural sentences. Claude Code interprets them and updates the correct file.

The assistant handles:

- Tasks for today
- Tasks with upcoming deadlines
- Tasks in the backlog
- Free ideas
- Notes attached to specific tasks
- Archiving of finished and dropped work
- Daily schedule (meetings and scheduled tasks)

Claude must always keep the folder clean and predictable.

---

## Architecture

### High-Level Structure

The project is a folder-based system.  
Claude Code edits and reads files to manage tasks and ideas.  
There is no server, no build step, and no runtime.

### Directory Layout

PersonalAssistant/
    tasks/
        today.md
        due_soon.md
        backlog.md
    ideas/
        inbox.md
    archive/
        done.md
        dropped.md
    config/
        task_template.md
        tags.md
        settings.json
        daily_recurring.md
    schedule/
        YYYY-MM-DD.json
    attachments/
    logs/

### Key Components

**tasks folder**  
Holds active tasks split into three files. Each task follows a structured block.

**ideas folder**  
Holds loose, unstructured thoughts. These are not tasks until Stefan asks to promote them.

**archive folder**  
Stores completed or abandoned tasks.

**config folder**
Holds templates, tag lists, settings, and daily recurring task templates that guide Claude Code.

**schedule folder**
Stores daily schedule files in JSON format (one file per day: YYYY-MM-DD.json). Each file contains:
- meetings: Array of meeting objects with id, title, startTime, endTime, and notes
- scheduledTasks: Array of tasks scheduled to specific time slots with taskId, taskTitle, startTime, endTime, and duration

**attachments folder**
Stores images and screenshots that are referenced in task notes.

**logs folder**
Optional. Used for short messages describing file changes.

### Data Flow

1. Stefan sends a message.  
2. Claude Code classifies the message: add, update, move, show, or help.  
3. Claude Code edits the correct file in the correct folder.  
4. Claude Code responds with a short confirmation.

Tasks with deadlines move to due_soon when the date gets close.  
Tasks move to today only when Stefan requests.

### Technology Stack

Plain text and markdown for tasks and ideas.
JSON for schedule data (meetings and scheduled tasks).
No external tools or dependencies.

---

## Important Patterns and Conventions

### Task Format

All tasks follow this structure:

{{title}}

id: task-slug
parent_id: none
subtasks: none
status: open
priority: none
deadline: none
target_date: none
days_in_today: 0
notes:
- ...
- ...

### Meaning of fields

- **id**: unique identifier (lowercase, hyphens, based on task title)
- **parent_id**: ID of parent task if this is a subtask, otherwise "none"
- **subtasks**: comma-separated list of subtask IDs, or "none"
- **deadline**: hard, fixed date
- **target_date**: soft preferred completion time
- **priority**: high, medium, low
- **days_in_today**: counter for how many days task has been in today.md (only for tasks in today.md)
- **completed_date**: date task was completed (YYYY-MM-DD format, only for archived tasks)
- **notes**: free-form list managed by Claude Code

### Task IDs and Subtasks

**ID Generation:**
- IDs are auto-generated from task titles
- Format: lowercase, words separated by hyphens, short and readable
- Example: "Look at NVidia PO" → `nvidia-po`
- IDs must be unique across all tasks (today, due_soon, backlog, archive)

**Creating Subtasks:**
- Set the subtask's `parent_id` to the parent task's `id`
- Add the subtask's `id` to the parent's `subtasks` list
- Subtasks can live in any file (don't have to be near parent)
- Subtasks have full task metadata (deadlines, priorities, etc.)

**Example Parent Task:**
```
## Look at NVidia PO and see how we fit them into the roadmap
- id: nvidia-po
- parent_id: none
- subtasks: nvidia-po-rd, nvidia-po-agency
- status: open
- notes:
  - Main task context
```

**Example Subtask:**
```
## Research R&D requirements for NVidia
- id: nvidia-po-rd
- parent_id: nvidia-po
- subtasks: none
- status: open
- deadline: 2025-12-01
- notes:
  - Subtask details
```

### Schedule Format

Schedule data is stored in JSON files in the `schedule/` folder, one file per day using the format `YYYY-MM-DD.json`.

**Structure:**
```json
{
  "date": "2026-01-13",
  "meetings": [
    {
      "id": "m-uuid-string",
      "title": "Team Sync",
      "startTime": "09:00",
      "endTime": "09:30",
      "notes": "Discuss Q1 roadmap"
    }
  ],
  "scheduledTasks": [
    {
      "taskId": "review-prs",
      "taskTitle": "Review PRs",
      "startTime": "14:00",
      "endTime": "15:00",
      "duration": 60
    }
  ]
}
```

**Meeting Fields:**
- **id**: Unique identifier (typically `m-` prefix with UUID)
- **title**: Meeting name
- **startTime**: Start time in HH:MM format (24-hour)
- **endTime**: End time in HH:MM format (24-hour)
- **notes**: Optional meeting notes or description

**Scheduled Task Fields:**
- **taskId**: ID of the task from tasks/today.md
- **taskTitle**: Title of the task (copied for display)
- **startTime**: Start time in HH:MM format (24-hour)
- **endTime**: End time in HH:MM format (24-hour)
- **duration**: Duration in minutes

**Managing Schedule:**
- Claude can read, create, update, and delete meetings and scheduled tasks
- Times are in 24-hour format (e.g., "14:30" for 2:30 PM)
- Tasks can be scheduled from the Today view in the UI
- Meetings can be added manually through the schedule sidebar

### Task Movement

- Move to **due_soon** when a deadline is close.
- Move to **today** only on request.
- Move from **today** back to **backlog** only on request.
- Archive tasks when marked done or dropped.
- When archiving, set status to "completed" and add `completed_date` field with today's date.

### End of Day Workflow

When Stefan says "end my day" or similar:

1. **Review unfinished tasks** in `today.md`
2. **Auto-keep tasks** with deadlines ≤3 days (they stay in today.md or move to due_soon.md)
3. **Ask about other tasks**: "Keep for tomorrow or move to backlog?"
4. **Increment `days_in_today`** counter for tasks that stay
5. **Add `days_in_today: 1`** for tasks newly moved to today.md
6. **Execute moves** based on decisions
7. **Provide summary**: tasks completed today, tasks kept for tomorrow, tasks moved to backlog

### Start of Day Workflow

When Stefan says "start my day" or similar:

1. **Show tasks already in today.md**:
   - Highlight tasks with `days_in_today > 1` (carried over from previous days)
   - Display with deadline/target_date

2. **Show prioritized available tasks** from `due_soon.md` and `backlog.md`:
   - Sort into priority tiers:
     * **Urgent**: Hard deadlines ≤2 days away
     * **Important**: Hard deadlines 3-7 days away
     * **Target Soon**: Target dates within 7 days
     * **Target Later**: Target dates 8-14 days out
     * **Backlog**: Everything else (no specific date or far out)

3. **Show daily recurring tasks** from `config/daily_recurring.md`:
   - Display all recurring tasks as optional additions
   - Number them separately (R1, R2, etc.)
   - Group by category for easier reading

4. **Display format**:
   ```
   📅 START OF DAY - [date]

   ALREADY ON TODAY:
     1. [Day X] Task name (DEADLINE/TARGET: date)

   URGENT (deadlines ≤2 days):
     2. Task name (DEADLINE: date)

   IMPORTANT (deadlines 3-7 days):
     3. Task name (DEADLINE: date)

   TARGET SOON (within 7 days):
     4. Task name (TARGET: date)

   📋 DAILY RECURRING TASKS (optional):
     R1. Push day (fitness)
     R2. Pull day (fitness)
     R3. Prep meetings for today (work)
   ```

5. **Ask for selection**:
   - "Which tasks do you want to add to today? (by number, 'all urgent', or 'none')"
   - "Which recurring tasks? (by number like 'R1, R3', 'all', or 'none')"

6. **Move selected tasks** to `today.md`:
   - Regular tasks with `days_in_today: 1`
   - Recurring tasks with unique instance IDs (e.g., `daily-push-20251127`) and `days_in_today: 1`

7. **Provide summary**: Total tasks for today, breakdown by urgency, recurring tasks added

### Focus Workflow

Stefan has a tendency to lose focus. Help him stay on track:

**Setting Focus:**
When Stefan says "focus on [task name/ID]" or "I'm working on [task]":
1. Find the task by title or ID
2. Save the task ID to `current_focus` in settings.json
3. Display the focus visual (see below)

**Showing Focus:**
When Stefan says "what's my focus?", "show focus", "keep me focused", or similar:
1. Read `current_focus` from settings.json
2. Find the task details
3. Display a large ASCII art box showing:
   - Task title
   - Deadline or target date (with urgency indicator)
   - Task notes/todos
   - How many days it's been in today
4. Add encouraging message to stay focused

**Focus Visual Format:**
```
╔═══════════════════════════════════════════════════════════════╗
║                                                                 ║
║                     🎯 CURRENT FOCUS                           ║
║                                                                 ║
╠═══════════════════════════════════════════════════════════════╣
║                                                                 ║
║  [Task Title]                                                  ║
║                                                                 ║
║  ⏰ DEADLINE: [date] [(urgency)]                               ║
║                                                                 ║
║  📝 TODO:                                                      ║
║     • [note 1]                                                 ║
║     • [note 2]                                                 ║
║                                                                 ║
║  ⏱️  [Day X in today]                                          ║
║                                                                 ║
╚═══════════════════════════════════════════════════════════════╝

                      👉 STAY FOCUSED! 👈
```

**Clearing Focus:**
- When a task is completed, clear `current_focus` (set to null)
- Ask Stefan what they want to focus on next

### Daily Recurring Tasks

Stefan has optional habits and routines that can be added to any day.

**Storage:**
- Templates stored in `config/daily_recurring.md`
- Each template has: title, id, category, notes
- All tasks always show during "start my day" workflow

**Task Format:**
```markdown
## Task name
- id: daily-task-id
- category: fitness|health|work|skills|learning
- notes:
  - Description
```

**During Start of Day:**
- All recurring tasks are shown as optional additions
- Stefan selects which ones to add for today (e.g., "R1, R3" or "all" or "none")
- Selected tasks are added to today.md with:
  - Unique instance ID (template-id + date, e.g., `daily-push-20251127`)
  - `days_in_today: 1`
  - `deadline: none` and `target_date: none`
  - Notes copied from template

**Managing Templates:**
- "Add recurring task: [name]" - create new template in daily_recurring.md
- "Remove recurring task: [name]" - delete template from daily_recurring.md
- "Show recurring tasks" - list all templates with categories

**Lifecycle:**
- Recurring task instances are treated like normal tasks
- Complete them → archive to done.md
- Don't complete → during "end of day", handle like any task
- Template persists for next day

### Ideas Format

Ideas in `ideas/inbox.md` are simple lines:

- Raw thought
- Something to explore

They never turn into tasks unless Stefan asks.

### Attachments Format

Screenshots and images can be attached to tasks:

- Store images in the `attachments/` folder
- Name files using: `task-slug_YYYYMMDD-HHMMSS.ext`
- Reference in task notes using markdown: `![description](../attachments/filename.png)`
- Example note: `![UI mockup screenshot](../attachments/part-analyzer-ui_20251127-140000.png)`

When Stefan provides a screenshot or image file path, Claude Code should copy it to attachments and add the reference to the task notes.

### Configuration

Stored in `config/settings.json`.  
Claude Code should check settings when needed.

---

## Error Handling

If Claude Code is unsure what the user meant, it should ask one short clarifying question.  
If a task does not exist, Claude should say so.  
If multiple tasks match a title, Claude should list them and ask which one to update.

Claude Code must never:

- Guess aggressively  
- Modify files outside the project  
- Change the folder structure unless requested  

---

## Development Notes

- Keep messages short and clear.
- Only modify the specific block that needs updating.
- Avoid rewriting entire files unless needed.
- Keep logs small and readable.
- Never reorder tasks unless Stefan asks.
- When creating new tasks, generate a unique ID from the task title.
- Ensure IDs are unique by checking existing tasks across all files.
- When creating subtasks, update both the parent's `subtasks` field and the subtask's `parent_id` field.
- **Every task must have EITHER a deadline OR a target_date** (never both set to "none"). If Stefan doesn't specify, ask which one to use.
- Tasks in `today.md` should have a `days_in_today` field; increment it during "end of day" if the task stays.
- Tasks in `backlog.md` and `due_soon.md` don't need the `days_in_today` field (or set it to 0).
- When Stefan says "start my day", follow the Start of Day Workflow to show prioritized tasks and help fill today's list.
- When Stefan says "end my day", follow the End of Day Workflow to review unfinished tasks and clean up.
- When Stefan says "focus on [task]", follow the Focus Workflow to help him stay on track.
- Stefan loses focus easily - proactively remind him what he's working on if he seems distracted.
