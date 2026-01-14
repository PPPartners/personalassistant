import React from 'react';
import Card from './ui/Card';
import Badge from './ui/Badge';
import { getTaskUrgency, formatDeadline, getUrgencyColor, getUrgencyTextColor, getUrgencyLabel } from '../utils/dateUtils';

function TaskCard({ task, columnId, onView, onMarkDone, onMarkDropped, onQuickPriorityChange, onMoveToBacklog, onStartPomodoro }) {
  const urgency = getTaskUrgency(task);
  const urgencyColor = getUrgencyColor(urgency);
  const urgencyTextColor = getUrgencyTextColor(urgency);
  const urgencyLabel = getUrgencyLabel(urgency);

  const hasDeadline = task.deadline !== 'none';
  const hasTargetDate = task.target_date !== 'none';
  const hasSubtasks = task.subtasks !== 'none';

  const handlePriorityClick = (e) => {
    e.stopPropagation(); // Don't trigger card click

    if (!onQuickPriorityChange) return;

    // Cycle through priorities: none → high → medium → low → none
    const currentPriority = task.priority || 'none';
    const priorityCycle = { 'none': 'high', 'high': 'medium', 'medium': 'low', 'low': 'none' };
    const newPriority = priorityCycle[currentPriority];

    onQuickPriorityChange(task, newPriority);
  };

  const handleDone = (e) => {
    e.stopPropagation();
    if (confirm(`Mark "${task.title}" as done?`)) {
      if (onMarkDone) {
        onMarkDone(task, columnId);
      }
    }
  };

  const handleCancel = (e) => {
    e.stopPropagation();
    if (confirm(`Cancel "${task.title}" and mark as dropped?`)) {
      if (onMarkDropped) {
        onMarkDropped(task, columnId);
      }
    }
  };

  const handleMoveToBacklog = (e) => {
    e.stopPropagation();
    if (confirm(`Move "${task.title}" back to backlog?`)) {
      if (onMoveToBacklog) {
        onMoveToBacklog(task, columnId);
      }
    }
  };

  const handleStartPomodoro = (e) => {
    e.stopPropagation();
    if (onStartPomodoro) {
      onStartPomodoro(task);
    }
  };

  const getPriorityIcon = () => {
    const priority = task.priority || 'none';
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const getPriorityTooltip = () => {
    const priority = task.priority || 'none';
    switch (priority) {
      case 'high': return 'High Priority - Click to change';
      case 'medium': return 'Medium Priority - Click to change';
      case 'low': return 'Low Priority - Click to change';
      default: return 'No Priority - Click to set';
    }
  };

  const getUrgencyBadgeVariant = () => {
    if (!hasDeadline && !hasTargetDate) return null;

    switch(urgency) {
      case 'overdue': return 'urgency-overdue';
      case 'critical': return 'urgency-critical';
      case 'soon': return 'urgency-soon';
      case 'upcoming': return 'urgency-upcoming';
      default: return 'urgency-normal';
    }
  };

  const getPriorityBadgeVariant = () => {
    const priority = task.priority || 'none';
    return `priority-${priority}`;
  };

  return (
    <Card
      variant="interactive"
      className={`p-3 group relative flex flex-col border-l-4 ${urgencyColor}`}
      onClick={() => onView && onView(task, columnId)}
    >
          {/* Quick Priority Toggle - Top Right */}
          {onQuickPriorityChange && columnId === 'today' && (
            <button
              onClick={handlePriorityClick}
              className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-dark-hover transition-all group/priority"
              title={getPriorityTooltip()}
            >
              <span className="text-base">{getPriorityIcon()}</span>
            </button>
          )}

          {/* Task Title */}
          <div className="flex items-start justify-between gap-2 mb-2 pr-8">
            <h3 className="font-semibold text-sm text-text-primary flex-1 leading-tight">
              {task.title}
            </h3>
          </div>

          {/* Metadata Badges */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {/* Urgency Badge */}
            {getUrgencyBadgeVariant() && (
              <Badge variant={getUrgencyBadgeVariant()} size="sm" icon="⏰">
                {urgencyLabel || formatDeadline(task.deadline || task.target_date)}
              </Badge>
            )}

            {/* Target Date (if separate from deadline) */}
            {hasTargetDate && hasDeadline && (
              <Badge variant="info" size="sm" icon="🎯">
                {formatDeadline(task.target_date)}
              </Badge>
            )}

            {/* Days in Today */}
            {task.days_in_today > 0 && (
              <Badge variant="neutral" size="sm" icon="📌">
                Day {task.days_in_today}
              </Badge>
            )}

            {/* Subtasks */}
            {hasSubtasks && (
              <Badge variant="neutral" size="sm" icon="📋">
                {task.subtasks.split(',').length} sub
              </Badge>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-4 gap-2 mt-auto pt-3 border-t border-dark-border">
            <button
              onClick={handleDone}
              className="aspect-square flex items-center justify-center text-success-400 bg-success-500/10 hover:bg-success-500/20 border border-success-500/30 hover:border-success-400/50 rounded-md transition-all hover:scale-105 active:scale-95 shadow-sm"
              title="Mark as done"
            >
              <span className="text-lg">✓</span>
            </button>
            <button
              onClick={handleCancel}
              className="aspect-square flex items-center justify-center text-text-secondary bg-dark-base/50 hover:bg-dark-base/70 border border-dark-border hover:border-text-tertiary/30 rounded-md transition-all hover:scale-105 active:scale-95 shadow-sm"
              title="Cancel and mark as dropped"
            >
              <span className="text-lg">✕</span>
            </button>
            <button
              onClick={handleMoveToBacklog}
              className="aspect-square flex items-center justify-center text-primary-400 bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/30 hover:border-primary-400/50 rounded-md transition-all hover:scale-105 active:scale-95 shadow-sm"
              title={columnId === 'today' ? 'Move back to original list' : 'Move to Today'}
            >
              <span className="text-lg">{columnId === 'today' ? '←' : '→'}</span>
            </button>
            <button
              onClick={handleStartPomodoro}
              className="aspect-square flex items-center justify-center bg-warning-500/10 hover:bg-warning-500/20 border border-warning-500/30 hover:border-warning-400/50 rounded-md transition-all hover:scale-105 active:scale-95 shadow-sm"
              title="Start Focus"
            >
              <span className="text-lg">🍅</span>
            </button>
          </div>
    </Card>
  );
}

export default TaskCard;
