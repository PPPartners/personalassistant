import React from 'react';

function MeetingBlock({ meeting, onEdit, onDelete, onDragStart, onResizeStart }) {
  const formatTime = (time) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  const calculateDuration = () => {
    const [startHours, startMinutes] = meeting.startTime.split(':').map(Number);
    const [endHours, endMinutes] = meeting.endTime.split(':').map(Number);

    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    const durationMinutes = endTotalMinutes - startTotalMinutes;

    if (durationMinutes < 60) {
      return `${durationMinutes} min`;
    }
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getDurationMinutes = () => {
    const [startHours, startMinutes] = meeting.startTime.split(':').map(Number);
    const [endHours, endMinutes] = meeting.endTime.split(':').map(Number);
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    return endTotalMinutes - startTotalMinutes;
  };

  const isShortMeeting = getDurationMinutes() <= 45;

  return (
    <div
      className={`group bg-blue-100 border-l-4 border-blue-500 rounded p-2 hover:shadow-md transition-shadow h-full flex cursor-move relative ${isShortMeeting ? 'items-center' : 'flex-col items-start'}`}
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        if (onDragStart) {
          const rect = e.currentTarget.getBoundingClientRect();
          const grabY = e.clientY;
          const itemTop = rect.top;
          onDragStart({ type: 'meeting', data: meeting }, grabY, itemTop);
        }
      }}
    >
      {/* Top Resize Handle */}
      <div
        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-blue-300 opacity-0 group-hover:opacity-100 transition-opacity"
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          onResizeStart && onResizeStart({ type: 'meeting', data: meeting, edge: 'top' });
        }}
      />

      <div className={`flex justify-between gap-2 w-full ${isShortMeeting ? 'items-center' : 'items-start'}`}>
        <div className={`flex-1 min-w-0 flex ${isShortMeeting ? 'items-center' : 'items-start'}`}>
          {isShortMeeting ? (
            // Short meetings: only show title, smaller text for very short meetings
            <h4 className={`font-medium text-blue-900 truncate ${getDurationMinutes() <= 20 ? 'text-xs' : 'text-sm'}`}>
              {meeting.title}
            </h4>
          ) : (
            // Long meetings: show title first, then time and notes
            <div className="w-full">
              <div className="font-medium text-sm text-blue-900 truncate">
                {meeting.title}
              </div>
              <div className="text-xs text-blue-700 mt-0.5">
                {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
                <span className="ml-2 text-blue-600">({calculateDuration()})</span>
              </div>
              {meeting.notes && (
                <div className="text-xs text-blue-600 mt-1 line-clamp-2">
                  {meeting.notes}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(meeting)}
            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-200 rounded"
            title="Edit meeting"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(meeting.id)}
            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded"
            title="Delete meeting"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Bottom Resize Handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-blue-300 opacity-0 group-hover:opacity-100 transition-opacity"
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          onResizeStart && onResizeStart({ type: 'meeting', data: meeting, edge: 'bottom' });
        }}
      />
    </div>
  );
}

export default MeetingBlock;
