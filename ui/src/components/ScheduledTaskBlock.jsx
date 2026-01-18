import React from 'react';

function ScheduledTaskBlock({ scheduledTask, onRemove, onDragStart, onResizeStart, isOverlapping = false, timeFormat = '12h' }) {
  const formatTime = (time) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);

    if (timeFormat === '24h') {
      return `${String(hour).padStart(2, '0')}:${minutes}`;
    }

    // 12-hour format
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  const calculateDuration = () => {
    const [startHours, startMinutes] = scheduledTask.startTime.split(':').map(Number);
    const [endHours, endMinutes] = scheduledTask.endTime.split(':').map(Number);
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    const durationMinutes = endTotalMinutes - startTotalMinutes;

    if (durationMinutes < 60) {
      return `${durationMinutes}m`;
    }
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  };

  const getDurationMinutes = () => {
    const [startHours, startMinutes] = scheduledTask.startTime.split(':').map(Number);
    const [endHours, endMinutes] = scheduledTask.endTime.split(':').map(Number);
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    return endTotalMinutes - startTotalMinutes;
  };

  const isShortTask = getDurationMinutes() <= 45;

  return (
    <div
      className={`bg-green-50 rounded p-2 hover:shadow-sm transition-shadow group h-full flex cursor-move relative border-2 border-green-400 border-l-4 border-l-green-500 ${isShortTask ? 'items-center' : 'items-start'}`}
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        if (onDragStart) {
          const rect = e.currentTarget.getBoundingClientRect();
          const grabY = e.clientY;
          const itemTop = rect.top;
          onDragStart({ type: 'scheduledTask', data: scheduledTask }, grabY, itemTop);
        }
      }}
    >
      {/* Top Resize Handle */}
      <div
        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-green-300 opacity-0 group-hover:opacity-100 transition-opacity"
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          onResizeStart && onResizeStart({ type: 'scheduledTask', data: scheduledTask, edge: 'top' });
        }}
      />

      <div className={`flex justify-between gap-2 w-full ${isShortTask ? 'items-start' : 'items-start'}`}>
        <div className={`flex-1 min-w-0 flex ${isShortTask ? 'items-start' : 'items-start'}`}>
          {isShortTask ? (
            // Short tasks: if overlapping, use truncate; otherwise wrap
            <h4 className={`font-medium text-neutral-800 ${isOverlapping ? 'truncate' : 'break-words'} ${getDurationMinutes() <= 20 ? 'text-xs' : 'text-sm'}`}>
              {scheduledTask.taskTitle}
            </h4>
          ) : (
            // Long tasks: show title with wrapping, then time
            <div className="w-full">
              <h4 className="text-sm font-medium text-neutral-800 break-words mb-1">
                {scheduledTask.taskTitle}
              </h4>
              {!isOverlapping && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-green-700">
                    {formatTime(scheduledTask.startTime)} - {formatTime(scheduledTask.endTime)}
                  </span>
                  <span className="text-xs text-green-600">
                    ({calculateDuration()})
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => onRemove(scheduledTask.taskId)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-green-100 rounded"
          title="Remove from schedule"
        >
          <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Bottom Resize Handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-green-300 opacity-0 group-hover:opacity-100 transition-opacity"
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          onResizeStart && onResizeStart({ type: 'scheduledTask', data: scheduledTask, edge: 'bottom' });
        }}
      />
    </div>
  );
}

export default ScheduledTaskBlock;
