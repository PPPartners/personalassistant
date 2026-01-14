import React from 'react';
import { Droppable } from 'react-beautiful-dnd';
import TaskCard from './TaskCard';

function TaskColumn({ title, subtitle, tasks, columnId, onViewTask, onMarkDone, onMoveTask, color = 'neutral' }) {
  const colorClasses = {
    primary: 'border-primary-300 bg-primary-50/30',
    warning: 'border-warning-300 bg-warning-50/30',
    neutral: 'border-neutral-300 bg-neutral-50'
  };

  const headerColors = {
    primary: 'text-primary-700',
    warning: 'text-warning-700',
    neutral: 'text-neutral-700'
  };

  return (
    <div className={`flex flex-col rounded-xl border-2 ${colorClasses[color]} overflow-hidden`}>
      {/* Column Header */}
      <div className="p-4 bg-white/80 border-b border-neutral-200">
        <h2 className={`text-lg font-bold ${headerColors[color]}`}>{title}</h2>
        <p className="text-sm text-neutral-500">{subtitle}</p>
      </div>

      {/* Task List */}
      <Droppable droppableId={columnId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 overflow-y-auto p-4 space-y-3 ${
              snapshot.isDraggingOver ? 'bg-primary-100/50' : ''
            }`}
          >
            {tasks.length === 0 ? (
              <div className="text-center py-12 text-neutral-400">
                <p>No tasks</p>
              </div>
            ) : (
              tasks.map((task, index) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={index}
                  columnId={columnId}
                  onView={onViewTask}
                  onMarkDone={onMarkDone}
                  onMove={onMoveTask}
                />
              ))
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Add Task Button */}
      <div className="p-4 bg-white/80 border-t border-neutral-200">
        <button className="w-full py-2 text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors text-sm font-medium">
          + Add Task
        </button>
      </div>
    </div>
  );
}

export default TaskColumn;
