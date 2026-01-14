/**
 * Parse markdown task files into structured task objects
 */

export function parseTaskFile(markdownContent) {
  const tasks = [];
  const lines = markdownContent.split('\n');

  let currentTask = null;
  let inNotes = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Task title (starts with ##)
    if (line.startsWith('## ')) {
      // Save previous task if exists
      if (currentTask) {
        tasks.push(currentTask);
      }

      // Start new task
      currentTask = {
        title: line.replace('## ', '').trim(),
        id: null,
        parent_id: 'none',
        subtasks: 'none',
        status: 'open',
        priority: 'none',
        deadline: 'none',
        target_date: 'none',
        days_in_today: 0,
        notes: [],
        rawLines: [line]
      };
      inNotes = false;
    }
    // Metadata fields
    else if (currentTask && line.trim().startsWith('- ')) {
      const metaLine = line.trim().substring(2); // Remove "- "
      currentTask.rawLines.push(line);

      if (metaLine.startsWith('id:')) {
        currentTask.id = metaLine.replace('id:', '').trim();
      }
      else if (metaLine.startsWith('parent_id:')) {
        currentTask.parent_id = metaLine.replace('parent_id:', '').trim();
      }
      else if (metaLine.startsWith('subtasks:')) {
        currentTask.subtasks = metaLine.replace('subtasks:', '').trim();
      }
      else if (metaLine.startsWith('status:')) {
        currentTask.status = metaLine.replace('status:', '').trim();
      }
      else if (metaLine.startsWith('priority:')) {
        currentTask.priority = metaLine.replace('priority:', '').trim();
      }
      else if (metaLine.startsWith('deadline:')) {
        currentTask.deadline = metaLine.replace('deadline:', '').trim();
      }
      else if (metaLine.startsWith('target_date:')) {
        currentTask.target_date = metaLine.replace('target_date:', '').trim();
      }
      else if (metaLine.startsWith('days_in_today:')) {
        currentTask.days_in_today = parseInt(metaLine.replace('days_in_today:', '').trim()) || 0;
      }
      else if (metaLine.startsWith('completed_date:')) {
        currentTask.completed_date = metaLine.replace('completed_date:', '').trim();
      }
      else if (metaLine.startsWith('notes:')) {
        inNotes = true;
      }
      else if (inNotes) {
        // Note item
        currentTask.notes.push(metaLine);
      }
    }
    // Empty lines or other content
    else if (currentTask) {
      currentTask.rawLines.push(line);
    }
  }

  // Save last task
  if (currentTask) {
    tasks.push(currentTask);
  }

  return tasks;
}

export function parseIdeas(markdownContent) {
  const lines = markdownContent.split('\n');
  const ideas = [];
  let currentIdea = null;

  for (const line of lines) {
    if (line.trim().startsWith('- ') && !line.startsWith('  ')) {
      // Main idea (starts with "- " but not indented)
      if (currentIdea) {
        ideas.push(currentIdea);
      }
      currentIdea = {
        text: line.trim().substring(2),
        details: []
      };
    } else if (currentIdea && line.startsWith('  - ')) {
      // Sub-point of idea (indented with 2 spaces)
      currentIdea.details.push(line.trim().substring(2));
    }
  }

  if (currentIdea) {
    ideas.push(currentIdea);
  }

  return ideas;
}

export function parseRecurringTasks(markdownContent) {
  const tasks = parseTaskFile(markdownContent);
  return tasks.map(task => ({
    ...task,
    category: task.notes.find(n => n.startsWith('category:'))?.replace('category:', '').trim() || 'general'
  }));
}

export function taskToMarkdown(task) {
  const lines = [];

  lines.push(`## ${task.title}`);
  lines.push(`- id: ${task.id || 'none'}`);
  lines.push(`- parent_id: ${task.parent_id || 'none'}`);
  lines.push(`- subtasks: ${task.subtasks || 'none'}`);
  lines.push(`- status: ${task.status || 'open'}`);
  lines.push(`- priority: ${task.priority || 'none'}`);
  lines.push(`- deadline: ${task.deadline || 'none'}`);
  lines.push(`- target_date: ${task.target_date || 'none'}`);

  if (task.days_in_today !== undefined) {
    lines.push(`- days_in_today: ${task.days_in_today}`);
  }

  if (task.completed_date) {
    lines.push(`- completed_date: ${task.completed_date}`);
  }

  lines.push('- notes:');
  if (task.notes && task.notes.length > 0) {
    task.notes.forEach(note => {
      lines.push(`  - ${note}`);
    });
  }

  return lines.join('\n');
}

export function generateTaskId(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 50);
}

export function rebuildTaskFile(headerLines, tasks) {
  const content = [];

  // Add header
  content.push(...headerLines);
  content.push('');

  // Add tasks
  tasks.forEach((task, index) => {
    content.push(taskToMarkdown(task));
    if (index < tasks.length - 1) {
      content.push('');
    }
  });

  return content.join('\n');
}

// Extract header lines (everything before first task)
export function extractHeader(markdownContent) {
  const lines = markdownContent.split('\n');
  const headerLines = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      break;
    }
    headerLines.push(line);
  }

  return headerLines;
}
