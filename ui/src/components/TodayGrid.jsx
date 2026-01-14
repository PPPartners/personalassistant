import React from 'react';
import TaskCard from './TaskCard';

function TodayGrid({ tasks, maxTasks, onViewTask, onMarkDone, onMarkDropped, onQuickPriorityChange, onQuickAdd, onScheduleTask, onToggleTodayStatus, onStartPomodoro }) {
  // Group tasks by priority
  const groupedTasks = {
    high: tasks.filter(t => t.priority === 'high'),
    medium: tasks.filter(t => t.priority === 'medium'),
    low: tasks.filter(t => t.priority === 'low'),
    none: tasks.filter(t => !t.priority || t.priority === 'none')
  };

  const PrioritySection = ({ title, icon, tasks, borderColor, bgColor, priority }) => {
    if (tasks.length === 0) return null;

    const handleDragOver = (e) => {
      e.preventDefault(); // Allow drop
    };

    const handleDrop = (e) => {
      e.preventDefault();
      // For now, just accept the drop to enable dragging
      // Could implement priority change logic here later
    };

    return (
      <div
        className="mb-4"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className={`flex items-center gap-2 mb-3 pb-2 border-l-4 ${borderColor} pl-3`}>
          <span className="text-lg">{icon}</span>
          <h3 className="text-base font-bold text-text-primary">{title}</h3>
          <span className={`text-xs font-medium ${bgColor} px-2 py-0.5 rounded-full`}>
            {tasks.length}
          </span>
        </div>
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              columnId="today"
              onView={onViewTask}
              onMarkDone={onMarkDone}
              onMarkDropped={onMarkDropped}
              onQuickPriorityChange={onQuickPriorityChange}
              onMoveToBacklog={onToggleTodayStatus}
              onStartPomodoro={onStartPomodoro}
            />
          ))}
        </div>
      </div>
    );
  };

  const handleMainDragOver = (e) => {
    e.preventDefault(); // Allow drop
  };

  const handleMainDrop = (e) => {
    e.preventDefault();
    // Accept drop to enable dragging
  };

  return (
    <div
      className="h-full overflow-y-auto bg-dark-base p-4"
      onDragOver={handleMainDragOver}
      onDrop={handleMainDrop}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-text-primary">
            Today - {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h2>
          <p className="text-sm text-text-tertiary mt-0.5">
            {tasks.length}/{maxTasks} tasks
          </p>
        </div>

        {/* Tasks by Priority */}
        {tasks.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">✨</div>
            <h3 className="text-xl font-semibold text-text-primary mb-2">No tasks for today</h3>
            <p className="text-text-tertiary">Click "Start Day" to add tasks from your backlog</p>
          </div>
        ) : (
          <>
            <PrioritySection
              title="Must Do Today"
              icon="🔴"
              tasks={groupedTasks.high}
              borderColor="border-error-500"
              bgColor="bg-error-100 text-error-700"
            />
            <PrioritySection
              title="Should Do"
              icon="🟡"
              tasks={groupedTasks.medium}
              borderColor="border-warning-500"
              bgColor="bg-warning-100 text-warning-700"
            />
            <PrioritySection
              title="Nice to Have"
              icon="🟢"
              tasks={groupedTasks.low}
              borderColor="border-success-500"
              bgColor="bg-success-100 text-success-700"
            />
            <PrioritySection
              title="No Priority Set"
              icon="⚪"
              tasks={groupedTasks.none}
              borderColor="border-neutral-300"
              bgColor="bg-neutral-100 text-neutral-600"
            />
          </>
        )}

        {/* Quick Add Button */}
        <div className="mt-4">
          <button
            onClick={onQuickAdd}
            className="w-full py-3 border-2 border-dashed border-dark-border rounded-lg text-sm text-text-secondary hover:border-primary-500/50 hover:text-primary-400 hover:bg-dark-elevated transition-all"
          >
            <span className="text-base">+</span> Add Quick Task
          </button>
        </div>
      </div>
    </div>
  );
}

export default TodayGrid;
