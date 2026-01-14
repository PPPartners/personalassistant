import React from 'react';
import CompactTaskCard from './CompactTaskCard';
import Badge from './ui/Badge';

function AllTasksView({ tasks, onViewTask }) {
  return (
    <div className="h-full bg-dark-base p-4">
      <div className="h-full grid grid-cols-3 gap-4">
        {/* Column 1: Today */}
        <div className="flex flex-col bg-dark-surface rounded-lg border border-dark-border overflow-hidden shadow-glass-sm">
          <div className="bg-dark-elevated border-b-2 border-primary-500/50 px-4 py-3 flex items-center justify-between">
            <h2 className="font-semibold text-base text-text-primary">📋 Today</h2>
            <Badge variant="info" size="sm">
              {tasks.today.length}
            </Badge>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {tasks.today.length === 0 ? (
              <div className="text-center py-8 text-text-tertiary">
                <p className="text-sm">No tasks</p>
              </div>
            ) : (
              tasks.today.map((task) => (
                <CompactTaskCard
                  key={task.id}
                  task={task}
                  columnId="today"
                  onView={onViewTask}
                />
              ))
            )}
          </div>
        </div>

        {/* Column 2: Overdue + Due Soon */}
        <div className="flex flex-col bg-dark-surface rounded-lg border border-dark-border overflow-hidden shadow-glass-sm">
          {/* Overdue Section */}
          {tasks.overdue.length > 0 && (
            <>
              <div className="bg-dark-elevated border-b-2 border-danger-500/50 px-4 py-3 flex items-center justify-between">
                <h2 className="font-semibold text-base text-text-primary">⚠️ Overdue</h2>
                <Badge variant="urgency-overdue" size="sm">
                  {tasks.overdue.length}
                </Badge>
              </div>
              <div className="p-3 space-y-2 border-b border-dark-border">
                {tasks.overdue.map((task) => (
                  <CompactTaskCard
                    key={task.id}
                    task={task}
                    columnId="overdue"
                    onView={onViewTask}
                  />
                ))}
              </div>
            </>
          )}

          {/* Due Soon Section */}
          <div className="bg-dark-elevated border-b-2 border-warning-500/50 px-4 py-3 flex items-center justify-between">
            <h2 className="font-semibold text-base text-text-primary">⏰ Due Soon</h2>
            <Badge variant="urgency-soon" size="sm">
              {tasks.dueSoon.length}
            </Badge>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {tasks.dueSoon.length === 0 ? (
              <div className="text-center py-8 text-text-tertiary">
                <p className="text-sm">No tasks</p>
              </div>
            ) : (
              tasks.dueSoon.map((task) => (
                <CompactTaskCard
                  key={task.id}
                  task={task}
                  columnId="dueSoon"
                  onView={onViewTask}
                />
              ))
            )}
          </div>
        </div>

        {/* Column 3: Backlog */}
        <div className="flex flex-col bg-dark-surface rounded-lg border border-dark-border overflow-hidden shadow-glass-sm">
          <div className="bg-dark-elevated border-b-2 border-text-tertiary/30 px-4 py-3 flex items-center justify-between">
            <h2 className="font-semibold text-base text-text-primary">📦 Backlog</h2>
            <Badge variant="neutral" size="sm">
              {tasks.backlog.length}
            </Badge>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {tasks.backlog.length === 0 ? (
              <div className="text-center py-8 text-text-tertiary">
                <p className="text-sm">No tasks</p>
              </div>
            ) : (
              tasks.backlog.map((task) => (
                <CompactTaskCard
                  key={task.id}
                  task={task}
                  columnId="backlog"
                  onView={onViewTask}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AllTasksView;
