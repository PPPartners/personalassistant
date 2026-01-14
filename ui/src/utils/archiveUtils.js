import { parseTaskFile, extractHeader } from './markdownParser';
import { saveTasksToFile } from './fileWriter';

/**
 * Restore task from archive to an active column
 * @param {Object} task - The archived task to restore
 * @param {String} destination - 'today', 'dueSoon', or 'backlog'
 * @param {String} archiveType - 'done' or 'dropped'
 */
export async function restoreTask(task, destination, archiveType = 'done') {
  // Read current active tasks
  const tasksResult = await window.electronAPI.readAllTasks();
  if (!tasksResult.success) {
    throw new Error('Failed to read tasks');
  }

  const { today, dueSoon, backlog } = tasksResult.data;

  const tasks = {
    today: parseTaskFile(today),
    dueSoon: parseTaskFile(dueSoon),
    backlog: parseTaskFile(backlog)
  };

  const headers = {
    today: extractHeader(today),
    dueSoon: extractHeader(dueSoon),
    backlog: extractHeader(backlog)
  };

  // Prepare task for restoration
  const restoredTask = {
    ...task,
    status: 'open', // Reset to open
    days_in_today: destination === 'today' ? 1 : 0,
    completed_date: undefined // Remove completion date
  };

  // Remove completed_date field entirely
  delete restoredTask.completed_date;

  // Add to destination column
  const columnToFile = {
    today: 'tasks/today.md',
    dueSoon: 'tasks/due_soon.md',
    backlog: 'tasks/backlog.md'
  };

  const updatedTasks = [...tasks[destination], restoredTask];
  await saveTasksToFile(columnToFile[destination], updatedTasks, headers[destination]);

  // Remove from archive
  const archiveFile = archiveType === 'done' ? 'archive/done.md' : 'archive/dropped.md';
  const archiveResult = await window.electronAPI.readFile(archiveFile);

  if (archiveResult.success) {
    const archivedTasks = parseTaskFile(archiveResult.content);
    const archiveHeader = extractHeader(archiveResult.content);

    // Remove task from archive (match by id or title if id is 'none')
    const remainingTasks = archivedTasks.filter(t => {
      if (task.id && task.id !== 'none') {
        return t.id !== task.id;
      }
      return t.title !== task.title || t.completed_date !== task.completed_date;
    });

    await saveTasksToFile(archiveFile, remainingTasks, archiveHeader);
  }

  return restoredTask;
}

/**
 * Move task from done.md to dropped.md (or vice versa)
 */
export async function moveToArchiveType(task, fromType, toType) {
  const fromFile = fromType === 'done' ? 'archive/done.md' : 'archive/dropped.md';
  const toFile = toType === 'done' ? 'archive/done.md' : 'archive/dropped.md';

  // Read both archives
  const [fromResult, toResult] = await Promise.all([
    window.electronAPI.readFile(fromFile),
    window.electronAPI.readFile(toFile)
  ]);

  if (!fromResult.success || !toResult.success) {
    throw new Error('Failed to read archive files');
  }

  const fromTasks = parseTaskFile(fromResult.content);
  const fromHeader = extractHeader(fromResult.content);

  const toTasks = parseTaskFile(toResult.content);
  const toHeader = extractHeader(toResult.content);

  // Remove from source
  const remainingFromTasks = fromTasks.filter(t => {
    if (task.id && task.id !== 'none') {
      return t.id !== task.id;
    }
    return t.title !== task.title || t.completed_date !== task.completed_date;
  });

  // Add to destination
  const updatedToTasks = [...toTasks, task];

  // Save both files
  await Promise.all([
    saveTasksToFile(fromFile, remainingFromTasks, fromHeader),
    saveTasksToFile(toFile, updatedToTasks, toHeader)
  ]);

  return task;
}

/**
 * Permanently delete task from archive
 */
export async function permanentlyDeleteTask(task, archiveType = 'done') {
  const archiveFile = archiveType === 'done' ? 'archive/done.md' : 'archive/dropped.md';

  const archiveResult = await window.electronAPI.readFile(archiveFile);
  if (!archiveResult.success) {
    throw new Error('Failed to read archive file');
  }

  const archivedTasks = parseTaskFile(archiveResult.content);
  const archiveHeader = extractHeader(archiveResult.content);

  // Remove task from archive (match by id or title+date if id is 'none')
  const remainingTasks = archivedTasks.filter(t => {
    if (task.id && task.id !== 'none') {
      return t.id !== task.id;
    }
    return t.title !== task.title || t.completed_date !== task.completed_date;
  });

  await saveTasksToFile(archiveFile, remainingTasks, archiveHeader);

  return true;
}
