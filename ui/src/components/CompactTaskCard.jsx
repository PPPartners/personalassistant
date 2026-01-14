import React from 'react';
import Card from './ui/Card';
import Badge from './ui/Badge';
import { getTaskUrgency, formatDeadline, getUrgencyColor } from '../utils/dateUtils';

function CompactTaskCard({ task, columnId, onView }) {
  const urgency = getTaskUrgency(task);
  const urgencyColor = getUrgencyColor(urgency);

  const hasDeadline = task.deadline !== 'none';
  const hasTargetDate = task.target_date !== 'none';

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

  return (
    <Card
      variant="interactive"
      className={`p-2.5 border-l-4 ${urgencyColor}`}
      onClick={() => onView(task, columnId)}
    >
      {/* Title */}
      <h4 className="font-medium text-sm text-text-primary leading-tight line-clamp-2 mb-2">
        {task.title}
      </h4>

      {/* Date Badge */}
      <div className="flex gap-1.5">
        {hasDeadline && (
          <Badge variant={getUrgencyBadgeVariant() || 'neutral'} size="sm" icon="⏰">
            {formatDeadline(task.deadline)}
          </Badge>
        )}
        {hasTargetDate && !hasDeadline && (
          <Badge variant="info" size="sm" icon="🎯">
            {formatDeadline(task.target_date)}
          </Badge>
        )}
      </div>
    </Card>
  );
}

export default CompactTaskCard;
