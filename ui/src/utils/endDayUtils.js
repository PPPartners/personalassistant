import { parseISO, differenceInDays } from 'date-fns';
import { parseTaskFile } from './markdownParser';

/**
 * Categorize unfinished tasks into auto-keep and decision-needed
 * Auto-keep: tasks with deadlines ≤3 days
 * Decision-needed: all other tasks
 */
export function categorizeUnfinishedTasks(tasks) {
  const autoKeep = [];
  const needDecision = [];

  tasks.forEach(task => {
    if (task.deadline !== 'none') {
      try {
        const deadlineDate = parseISO(task.deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const daysUntil = differenceInDays(deadlineDate, today);

        // Auto-keep tasks with deadlines ≤3 days
        if (daysUntil <= 3) {
          autoKeep.push(task);
        } else {
          needDecision.push(task);
        }
      } catch (error) {
        // Invalid date, needs decision
        needDecision.push(task);
      }
    } else {
      // No deadline, needs decision
      needDecision.push(task);
    }
  });

  return { autoKeep, needDecision };
}

/**
 * Get tasks completed today from archive
 */
export async function getCompletedTasksToday() {
  try {
    const result = await window.electronAPI.readFile('archive/done.md');
    if (!result.success) {
      return [];
    }

    const allCompletedTasks = parseTaskFile(result.content);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Filter tasks completed today
    return allCompletedTasks.filter(task => task.completed_date === today);
  } catch (error) {
    console.error('Error reading completed tasks:', error);
    return [];
  }
}

/**
 * Process End Day decisions
 * @param {Object} decisions - { keep: [taskIds], moveToBacklog: [taskIds] }
 * @param {Array} todayTasks - Current tasks in today.md
 * @param {Object} allTasks - All tasks { today, dueSoon, backlog }
 * @param {Object} headers - All headers { today, dueSoon, backlog }
 */
export async function processEndDayDecisions(decisions, todayTasks, allTasks, headers) {
  const { keep = [], moveToBacklog = [] } = decisions;

  // Tasks to keep (increment days_in_today)
  const updatedTodayTasks = todayTasks.map(task => {
    if (keep.includes(task.id)) {
      return {
        ...task,
        days_in_today: (task.days_in_today || 0) + 1
      };
    }
    return task;
  });

  // Filter out tasks moving to backlog
  const tasksStayingInToday = updatedTodayTasks.filter(
    task => !moveToBacklog.includes(task.id)
  );

  // Tasks moving to backlog (reset days_in_today)
  const tasksMovingToBacklog = todayTasks
    .filter(task => moveToBacklog.includes(task.id))
    .map(task => ({
      ...task,
      days_in_today: 0,
      priority: 'none' // Reset priority when moving to backlog
    }));

  // Combine with existing backlog
  const updatedBacklogTasks = [...allTasks.backlog, ...tasksMovingToBacklog];

  return {
    today: tasksStayingInToday,
    backlog: updatedBacklogTasks
  };
}
