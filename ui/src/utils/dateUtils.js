import { parseISO, differenceInDays, isPast, isToday, format } from 'date-fns';

export function getTaskUrgency(task) {
  if (task.deadline === 'none') return 'none';

  try {
    const deadlineDate = parseISO(task.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isPast(deadlineDate) && !isToday(deadlineDate)) {
      return 'overdue';
    }

    const daysUntil = differenceInDays(deadlineDate, today);

    if (daysUntil === 0) return 'today';
    if (daysUntil <= 2) return 'urgent';
    if (daysUntil <= 7) return 'soon';

    return 'future';
  } catch (error) {
    return 'none';
  }
}

export function formatDeadline(dateString) {
  if (dateString === 'none') return null;

  try {
    const date = parseISO(dateString);
    return format(date, 'MMM dd, yyyy');
  } catch (error) {
    return dateString;
  }
}

export function getUrgencyColor(urgency) {
  const colors = {
    overdue: 'border-danger-500',
    today: 'border-warning-500',
    urgent: 'border-warning-400',
    soon: 'border-primary-400',
    future: 'border-dark-border',
    none: 'border-dark-border'
  };

  return colors[urgency] || colors.none;
}

export function getUrgencyTextColor(urgency) {
  const colors = {
    overdue: 'text-danger-400',
    today: 'text-warning-400',
    urgent: 'text-warning-400',
    soon: 'text-primary-400',
    future: 'text-text-secondary',
    none: 'text-text-tertiary'
  };

  return colors[urgency] || colors.none;
}

export function getUrgencyLabel(urgency) {
  const labels = {
    overdue: 'OVERDUE',
    today: 'TODAY',
    urgent: 'URGENT',
    soon: 'SOON',
    future: 'SCHEDULED',
    none: ''
  };

  return labels[urgency] || '';
}

/**
 * Determine if a task is overdue
 * Returns true if deadline OR target_date is in the past (excluding today)
 */
export function isTaskOverdue(task) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check deadline first
  if (task.deadline && task.deadline !== 'none') {
    try {
      const deadlineDate = parseISO(task.deadline);
      if (isPast(deadlineDate) && !isToday(deadlineDate)) {
        return true;
      }
    } catch (error) {
      // Invalid date, continue
    }
  }

  // Check target_date if no deadline or deadline is not overdue
  if (task.target_date && task.target_date !== 'none') {
    try {
      const targetDate = parseISO(task.target_date);
      if (isPast(targetDate) && !isToday(targetDate)) {
        return true;
      }
    } catch (error) {
      // Invalid date
    }
  }

  return false;
}

/**
 * Determine if a task should be in "Due Soon" based on its dates
 * Returns true if deadline OR target_date is within 3 days
 */
export function shouldBeInDueSoon(task) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check deadline first
  if (task.deadline && task.deadline !== 'none') {
    try {
      const deadlineDate = parseISO(task.deadline);
      const daysUntil = differenceInDays(deadlineDate, today);
      if (daysUntil <= 3) {
        return true;
      }
    } catch (error) {
      // Invalid date, continue
    }
  }

  // Check target_date if no deadline or deadline is far out
  if (task.target_date && task.target_date !== 'none') {
    try {
      const targetDate = parseISO(task.target_date);
      const daysUntil = differenceInDays(targetDate, today);
      if (daysUntil <= 3) {
        return true;
      }
    } catch (error) {
      // Invalid date
    }
  }

  return false;
}

/**
 * Determine which column a task should be in when removed from "today"
 * based on its deadline or target_date
 */
export function determineDestinationColumn(task) {
  if (isTaskOverdue(task)) {
    return 'overdue';
  } else if (shouldBeInDueSoon(task)) {
    return 'dueSoon';
  } else {
    return 'backlog';
  }
}
