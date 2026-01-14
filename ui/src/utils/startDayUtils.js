import { differenceInDays, format } from 'date-fns';
import { parseTaskFile } from './markdownParser';

/**
 * Calculate days until a date
 */
function daysUntil(dateString) {
  if (!dateString || dateString === 'none') return Infinity;
  try {
    const targetDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return differenceInDays(targetDate, today);
  } catch {
    return Infinity;
  }
}

/**
 * Organize tasks into urgency tiers (works with single array)
 */
export function organizeTasks(tasks) {
  const tiers = {
    urgent: [],      // Deadlines ≤2 days
    important: [],   // Deadlines 3-7 days
    targetSoon: [],  // Target dates within 7 days
    targetLater: [], // Target dates 8-14 days
    backlog: []      // Everything else
  };

  tasks.forEach(task => {
    const hasDeadline = task.deadline && task.deadline !== 'none';
    const hasTarget = task.target_date && task.target_date !== 'none';

    if (hasDeadline) {
      const days = daysUntil(task.deadline);
      if (days <= 2) {
        tiers.urgent.push(task);
      } else if (days <= 7) {
        tiers.important.push(task);
      } else {
        tiers.backlog.push(task);
      }
    } else if (hasTarget) {
      const days = daysUntil(task.target_date);
      if (days <= 7) {
        tiers.targetSoon.push(task);
      } else if (days <= 14) {
        tiers.targetLater.push(task);
      } else {
        tiers.backlog.push(task);
      }
    } else {
      tiers.backlog.push(task);
    }
  });

  return tiers;
}

/**
 * Parse recurring tasks from markdown
 */
export function parseRecurringTasks(markdownContent) {
  const tasks = parseTaskFile(markdownContent);

  // Group by category
  const grouped = {};
  tasks.forEach(task => {
    const category = task.category || 'other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(task);
  });

  return grouped;
}

/**
 * Create a recurring task instance for today
 */
export function createRecurringInstance(template, date = new Date()) {
  const dateStr = format(date, 'yyyyMMdd');
  const todayDate = format(date, 'yyyy-MM-dd');

  return {
    ...template,
    id: `${template.id}-${dateStr}`,
    deadline: 'none',
    target_date: todayDate,
    status: 'open',
    priority: 'none',
    parent_id: 'none',
    subtasks: 'none',
    days_in_today: 1
  };
}

/**
 * Prepare tasks to add to today
 * - Tasks from due_soon/backlog get days_in_today: 1
 * - Recurring tasks become instances
 */
export function prepareTasksForToday(selectedFromAvailable, selectedRecurringTemplates) {
  const tasksToAdd = [];

  // Add selected available tasks
  selectedFromAvailable.forEach(task => {
    tasksToAdd.push({
      ...task,
      days_in_today: 1
    });
  });

  // Add recurring task instances
  selectedRecurringTemplates.forEach(template => {
    tasksToAdd.push(createRecurringInstance(template));
  });

  return tasksToAdd;
}
