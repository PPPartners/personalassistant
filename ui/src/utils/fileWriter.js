import { taskToMarkdown, extractHeader, generateTaskId } from './markdownParser';

/**
 * Save tasks back to markdown file
 */
export async function saveTasksToFile(filePath, tasks, headerContent = null) {
  const lines = [];

  // Add header if provided, otherwise use default
  if (headerContent) {
    lines.push(...headerContent);
  } else {
    // Default headers based on file path
    if (filePath.includes('today.md')) {
      lines.push('# Today', '', 'This file holds tasks Stefan wants to complete today.', '', '(Add tasks below this line.)', '');
    } else if (filePath.includes('due_soon.md')) {
      lines.push('# Due Soon', '', 'Tasks that have an upcoming deadline or are important to complete soon.', '', '(Claude Code moves tasks here automatically when deadlines get close.)', '', '(Add tasks below this line.)', '');
    } else if (filePath.includes('backlog.md')) {
      lines.push('# Backlog', '', 'Tasks that are active but not for today or soon.', 'They may have priority or target dates.', '', '(Add tasks below this line.)', '');
    }
  }

  // Add tasks
  tasks.forEach((task, index) => {
    lines.push(taskToMarkdown(task));
    if (index < tasks.length - 1) {
      lines.push(''); // Empty line between tasks
    }
  });

  lines.push(''); // Final empty line

  const content = lines.join('\n');

  // Write to file via Electron
  const relativePath = filePath.replace(/.*PersonalAssistant\//, '');
  const result = await window.electronAPI.writeFile(relativePath, content);

  if (!result.success) {
    throw new Error(`Failed to write file: ${result.error}`);
  }

  return result;
}

/**
 * Move task from one file to another
 */
export async function moveTask(task, fromColumn, toColumn, allTasks, headers) {
  const columnToFile = {
    today: 'tasks/today.md',
    dueSoon: 'tasks/due_soon.md',
    backlog: 'tasks/backlog.md',
    overdue: 'tasks/overdue.md'
  };

  // Update days_in_today counter
  const updatedTask = { ...task };

  if (toColumn === 'today' && fromColumn !== 'today') {
    // Moving TO today from elsewhere
    updatedTask.days_in_today = 1;
  } else if (fromColumn === 'today' && toColumn !== 'today') {
    // Moving FROM today to elsewhere
    updatedTask.days_in_today = 0;
  }

  // Remove from source
  const sourceTasks = allTasks[fromColumn].filter(t => t.id !== task.id);

  // Add to destination
  const destTasks = [...allTasks[toColumn], updatedTask];

  // Save both files
  await saveTasksToFile(columnToFile[fromColumn], sourceTasks, headers[fromColumn]);
  await saveTasksToFile(columnToFile[toColumn], destTasks, headers[toColumn]);

  return updatedTask;
}

/**
 * Mark task as done and move to archive
 */
export async function markTaskDone(task, fromColumn, allTasks, headers) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Update task
  const completedTask = {
    ...task,
    status: 'completed',
    completed_date: today
  };

  // Remove from source column
  const sourceTasks = allTasks[fromColumn].filter(t => t.id !== task.id);
  const columnToFile = {
    today: 'tasks/today.md',
    dueSoon: 'tasks/due_soon.md',
    backlog: 'tasks/backlog.md',
    overdue: 'tasks/overdue.md'
  };

  // Save source file
  await saveTasksToFile(columnToFile[fromColumn], sourceTasks, headers[fromColumn]);

  // Read current archive/done.md
  const archiveResult = await window.electronAPI.readFile('archive/done.md');
  if (!archiveResult.success) {
    throw new Error('Failed to read archive file');
  }

  // Parse existing done tasks
  const { parseTaskFile } = await import('./markdownParser');
  const doneTasks = parseTaskFile(archiveResult.content);

  // Add new completed task at the end
  const updatedDoneTasks = [...doneTasks, completedTask];

  // Archive header
  const archiveHeader = [
    '# Completed Tasks',
    '',
    'Claude stores finished tasks here in the same structured format.',
    'This helps track progress over time.',
    '',
    '(Add completed tasks below this line.)',
    ''
  ];

  // Save archive file
  await saveTasksToFile('archive/done.md', updatedDoneTasks, archiveHeader);

  // Update settings if this was the current focus
  const settingsResult = await window.electronAPI.readFile('config/settings.json');
  if (settingsResult.success) {
    const settings = JSON.parse(settingsResult.content);
    if (settings.current_focus === task.id) {
      settings.current_focus = null;
      await window.electronAPI.writeFile('config/settings.json', JSON.stringify(settings, null, 2));
    }
  }

  return completedTask;
}

/**
 * Mark a task as dropped/cancelled and archive it
 */
export async function markTaskDropped(task, fromColumn, allTasks, headers) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Update task
  const droppedTask = {
    ...task,
    status: 'dropped',
    completed_date: today
  };

  // Remove from source column
  const sourceTasks = allTasks[fromColumn].filter(t => t.id !== task.id);
  const columnToFile = {
    today: 'tasks/today.md',
    dueSoon: 'tasks/due_soon.md',
    backlog: 'tasks/backlog.md',
    overdue: 'tasks/overdue.md'
  };

  // Save source file
  await saveTasksToFile(columnToFile[fromColumn], sourceTasks, headers[fromColumn]);

  // Read current archive/dropped.md
  const archiveResult = await window.electronAPI.readFile('archive/dropped.md');
  if (!archiveResult.success) {
    throw new Error('Failed to read archive file');
  }

  // Parse existing dropped tasks
  const { parseTaskFile } = await import('./markdownParser');
  const droppedTasks = parseTaskFile(archiveResult.content);

  // Add new dropped task at the end
  const updatedDroppedTasks = [...droppedTasks, droppedTask];

  // Archive header
  const archiveHeader = [
    '# Dropped Tasks',
    '',
    'Claude stores cancelled or abandoned tasks here.',
    'These are tasks that were started but not completed.',
    '',
    '(Add dropped tasks below this line.)',
    ''
  ];

  // Save archive file
  await saveTasksToFile('archive/dropped.md', updatedDroppedTasks, archiveHeader);

  // Update settings if this was the current focus
  const settingsResult = await window.electronAPI.readFile('config/settings.json');
  if (settingsResult.success) {
    const settings = JSON.parse(settingsResult.content);
    if (settings.current_focus === task.id) {
      settings.current_focus = null;
      await window.electronAPI.writeFile('config/settings.json', JSON.stringify(settings, null, 2));
    }
  }

  return droppedTask;
}

/**
 * Update an existing task in its file
 * Auto-moves between dueSoon and backlog if dates change
 */
export async function updateTask(task, column, allTasks, headers) {
  const columnToFile = {
    today: 'tasks/today.md',
    dueSoon: 'tasks/due_soon.md',
    backlog: 'tasks/backlog.md',
    overdue: 'tasks/overdue.md'
  };

  // Check if task should auto-move between dueSoon and backlog
  let finalColumn = column;
  if (column === 'backlog' || column === 'dueSoon') {
    const { shouldBeInDueSoon } = await import('./dateUtils');
    const shouldBeDueSoon = shouldBeInDueSoon(task);
    const correctColumn = shouldBeDueSoon ? 'dueSoon' : 'backlog';

    if (correctColumn !== column) {
      // Task needs to move to different column
      // Remove from current column
      const sourceTasks = allTasks[column].filter(t => t.id !== task.id);
      await saveTasksToFile(columnToFile[column], sourceTasks, headers[column]);

      // Add to correct column
      const destTasks = [...allTasks[correctColumn], task];
      await saveTasksToFile(columnToFile[correctColumn], destTasks, headers[correctColumn]);

      return task;
    }
  }

  // No move needed, just update in place
  const updatedTasks = allTasks[column].map(t =>
    t.id === task.id ? task : t
  );

  // Save file
  await saveTasksToFile(columnToFile[column], updatedTasks, headers[column]);

  return task;
}

/**
 * Delete a task
 */
export async function deleteTask(task, fromColumn, allTasks, headers) {
  const columnToFile = {
    today: 'tasks/today.md',
    dueSoon: 'tasks/due_soon.md',
    backlog: 'tasks/backlog.md',
    overdue: 'tasks/overdue.md'
  };

  // Remove from tasks
  const updatedTasks = allTasks[fromColumn].filter(t => t.id !== task.id);

  // Save file
  await saveTasksToFile(columnToFile[fromColumn], updatedTasks, headers[fromColumn]);

  return true;
}

/**
 * Create a new task
 */
export async function createTask(taskData, column, allTasks, headers) {
  const columnToFile = {
    today: 'tasks/today.md',
    dueSoon: 'tasks/due_soon.md',
    backlog: 'tasks/backlog.md',
    overdue: 'tasks/overdue.md'
  };

  // Generate ID if not provided
  if (!taskData.id) {
    taskData.id = generateTaskId(taskData.title);
  }

  // Set defaults
  const newTask = {
    title: taskData.title,
    id: taskData.id,
    parent_id: taskData.parent_id || 'none',
    subtasks: taskData.subtasks || 'none',
    status: taskData.status || 'open',
    priority: taskData.priority || 'none',
    deadline: taskData.deadline || 'none',
    target_date: taskData.target_date || 'none',
    days_in_today: column === 'today' ? 1 : 0,
    notes: taskData.notes || []
  };

  // Auto-route to dueSoon or backlog based on dates
  // If user specified backlog or dueSoon, check if it should actually go to the other
  let finalColumn = column;
  if (column === 'backlog' || column === 'dueSoon') {
    const { shouldBeInDueSoon } = await import('./dateUtils');
    finalColumn = shouldBeInDueSoon(newTask) ? 'dueSoon' : 'backlog';
  }

  // Add to column
  const updatedTasks = [...allTasks[finalColumn], newTask];

  // Save file
  await saveTasksToFile(columnToFile[finalColumn], updatedTasks, headers[finalColumn]);

  return newTask;
}

/**
 * Add multiple tasks to today (for Start Day workflow)
 */
export async function addTasksToToday(tasksToAdd, existingTodayTasks, todayHeader) {
  // Combine existing tasks with new tasks
  const allTasks = [...existingTodayTasks, ...tasksToAdd];

  // Save to today.md
  await saveTasksToFile('tasks/today.md', allTasks, todayHeader);

  // For tasks that came from due_soon or backlog, we need to remove them from their source files
  // Group tasks by their original source
  const tasksFromDueSoon = tasksToAdd.filter(t => !t.id.startsWith('daily-'));
  const tasksFromBacklog = [];

  // Read and update due_soon.md
  if (tasksFromDueSoon.length > 0) {
    const dueSoonResult = await window.electronAPI.readFile('tasks/due_soon.md');
    if (dueSoonResult.success) {
      const { parseTaskFile, extractHeader } = await import('./markdownParser');
      const dueSoonTasks = parseTaskFile(dueSoonResult.content);
      const dueSoonHeader = extractHeader(dueSoonResult.content);

      // Remove moved tasks
      const movedIds = new Set(tasksFromDueSoon.map(t => t.id));
      const remainingDueSoon = dueSoonTasks.filter(t => !movedIds.has(t.id));

      await saveTasksToFile('tasks/due_soon.md', remainingDueSoon, dueSoonHeader);
    }
  }

  // Read and update backlog.md
  const backlogResult = await window.electronAPI.readFile('tasks/backlog.md');
  if (backlogResult.success) {
    const { parseTaskFile, extractHeader } = await import('./markdownParser');
    const backlogTasks = parseTaskFile(backlogResult.content);
    const backlogHeader = extractHeader(backlogResult.content);

    // Remove moved tasks (excluding recurring tasks which start with 'daily-')
    const movedIds = new Set(tasksToAdd.filter(t => !t.id.startsWith('daily-')).map(t => t.id));
    const remainingBacklog = backlogTasks.filter(t => !movedIds.has(t.id));

    await saveTasksToFile('tasks/backlog.md', remainingBacklog, backlogHeader);
  }

  return allTasks;
}

/**
 * Save End Day results (for End Day workflow)
 * Updates today.md and backlog.md based on user decisions
 */
export async function saveEndDayResults(updatedTodayTasks, updatedBacklogTasks, headers) {
  // Save today.md with updated tasks (incremented days_in_today)
  await saveTasksToFile('tasks/today.md', updatedTodayTasks, headers.today);

  // Save backlog.md with tasks moved back
  await saveTasksToFile('tasks/backlog.md', updatedBacklogTasks, headers.backlog);

  return true;
}

/**
 * Auto-migrate tasks from backlog to due_soon based on dates
 * Called on app startup to move tasks that became due soon overnight
 */
export async function autoMigrateBacklogToDueSoon() {
  try {
    // Read backlog and due_soon files
    const [backlogResult, dueSoonResult] = await Promise.all([
      window.electronAPI.readFile('tasks/backlog.md'),
      window.electronAPI.readFile('tasks/due_soon.md')
    ]);

    if (!backlogResult.success || !dueSoonResult.success) {
      console.warn('Could not read task files for auto-migration');
      return;
    }

    // Parse tasks and headers
    const { parseTaskFile, extractHeader } = await import('./markdownParser');
    const { shouldBeInDueSoon } = await import('./dateUtils');

    const backlogTasks = parseTaskFile(backlogResult.content);
    const dueSoonTasks = parseTaskFile(dueSoonResult.content);
    const backlogHeader = extractHeader(backlogResult.content);
    const dueSoonHeader = extractHeader(dueSoonResult.content);

    // Find tasks that should move to due_soon
    const tasksToMove = backlogTasks.filter(task => shouldBeInDueSoon(task));

    if (tasksToMove.length === 0) {
      // No tasks need to move
      return;
    }

    console.log(`Auto-migrating ${tasksToMove.length} task(s) from backlog to due_soon`);

    // Remove moved tasks from backlog
    const movedIds = new Set(tasksToMove.map(t => t.id));
    const remainingBacklog = backlogTasks.filter(t => !movedIds.has(t.id));

    // Add to due_soon
    const updatedDueSoon = [...dueSoonTasks, ...tasksToMove];

    // Save both files
    await saveTasksToFile('tasks/backlog.md', remainingBacklog, backlogHeader);
    await saveTasksToFile('tasks/due_soon.md', updatedDueSoon, dueSoonHeader);

    return tasksToMove.length;
  } catch (error) {
    console.error('Error in auto-migration:', error);
    return 0;
  }
}

/**
 * Auto-migrate overdue tasks to overdue.md
 * Checks today, due_soon, and backlog for overdue tasks and moves them
 */
export async function autoMigrateToOverdue() {
  try {
    // Read all task files including overdue
    const [todayResult, dueSoonResult, backlogResult, overdueResult] = await Promise.all([
      window.electronAPI.readFile('tasks/today.md'),
      window.electronAPI.readFile('tasks/due_soon.md'),
      window.electronAPI.readFile('tasks/backlog.md'),
      window.electronAPI.readFile('tasks/overdue.md')
    ]);

    // Parse tasks and headers
    const { parseTaskFile, extractHeader } = await import('./markdownParser');
    const { isTaskOverdue } = await import('./dateUtils');

    const todayTasks = todayResult.success ? parseTaskFile(todayResult.content) : [];
    const dueSoonTasks = dueSoonResult.success ? parseTaskFile(dueSoonResult.content) : [];
    const backlogTasks = backlogResult.success ? parseTaskFile(backlogResult.content) : [];
    const overdueTasks = overdueResult.success ? parseTaskFile(overdueResult.content) : [];

    const todayHeader = todayResult.success ? extractHeader(todayResult.content) : null;
    const dueSoonHeader = dueSoonResult.success ? extractHeader(dueSoonResult.content) : null;
    const backlogHeader = backlogResult.success ? extractHeader(backlogResult.content) : null;
    const overdueHeader = overdueResult.success ? extractHeader(overdueResult.content) : [
      '# Overdue Tasks',
      '',
      'Tasks with deadlines or target dates in the past.',
      'Claude Code automatically moves tasks here when they become overdue.',
      '',
      '(Tasks below this line.)',
      ''
    ];

    // Find overdue tasks in each file
    const overdueFromToday = todayTasks.filter(task => isTaskOverdue(task));
    const overdueFromDueSoon = dueSoonTasks.filter(task => isTaskOverdue(task));
    const overdueFromBacklog = backlogTasks.filter(task => isTaskOverdue(task));

    const allOverdueTasks = [...overdueFromToday, ...overdueFromDueSoon, ...overdueFromBacklog];

    if (allOverdueTasks.length === 0) {
      return 0;
    }

    console.log(`⚠️  Auto-migrating ${allOverdueTasks.length} overdue task(s) to overdue.md`);

    // Remove overdue tasks from source files
    const movedIds = new Set(allOverdueTasks.map(t => t.id));
    const remainingToday = todayTasks.filter(t => !movedIds.has(t.id));
    const remainingDueSoon = dueSoonTasks.filter(t => !movedIds.has(t.id));
    const remainingBacklog = backlogTasks.filter(t => !movedIds.has(t.id));

    // Add to overdue (avoid duplicates)
    const existingOverdueIds = new Set(overdueTasks.map(t => t.id));
    const newOverdueTasks = allOverdueTasks.filter(t => !existingOverdueIds.has(t.id));
    const updatedOverdue = [...overdueTasks, ...newOverdueTasks];

    // Save all files
    if (todayResult.success) {
      await saveTasksToFile('tasks/today.md', remainingToday, todayHeader);
    }
    if (dueSoonResult.success) {
      await saveTasksToFile('tasks/due_soon.md', remainingDueSoon, dueSoonHeader);
    }
    if (backlogResult.success) {
      await saveTasksToFile('tasks/backlog.md', remainingBacklog, backlogHeader);
    }
    await saveTasksToFile('tasks/overdue.md', updatedOverdue, overdueHeader);

    return allOverdueTasks.length;
  } catch (error) {
    console.error('Error in overdue auto-migration:', error);
    return 0;
  }
}
