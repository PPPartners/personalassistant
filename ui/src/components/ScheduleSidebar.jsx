import React, { useState, useEffect } from 'react';
import MeetingBlock from './MeetingBlock';
import AddMeetingModal from './AddMeetingModal';
import ScheduledTaskBlock from './ScheduledTaskBlock';

function ScheduleSidebar({ schedule, onUpdateSchedule, draggedItem, setDraggedItem, todayTasks }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isExpanded, setIsExpanded] = useState(true);
  const [dropPreview, setDropPreview] = useState(null);
  const [resizingItem, setResizingItem] = useState(null);
  const [showUnscheduled, setShowUnscheduled] = useState(true);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const START_HOUR = 0;  // 12 AM (midnight)
  const END_HOUR = 23;   // 11 PM (last hour is 23:00-24:00)
  const HOUR_HEIGHT = 60; // pixels per hour

  const handleSaveMeeting = (meetingData) => {
    const updatedMeetings = editingMeeting
      ? schedule.meetings.map(m => m.id === meetingData.id ? meetingData : m)
      : [...schedule.meetings, meetingData];

    onUpdateSchedule({
      ...schedule,
      meetings: updatedMeetings
    });
  };

  const handleEditMeeting = (meeting) => {
    setEditingMeeting(meeting);
    setShowAddModal(true);
  };

  const handleDeleteMeeting = (meetingId) => {
    if (confirm('Delete this meeting?')) {
      onUpdateSchedule({
        ...schedule,
        meetings: schedule.meetings.filter(m => m.id !== meetingId)
      });
    }
  };

  const handleHourClick = (hour) => {
    const time = `${String(hour).padStart(2, '0')}:00`;
    setSelectedTime(time);
    setEditingMeeting(null);
    setShowAddModal(true);
  };

  const formatHour = (hour) => {
    if (hour === 0) return '12a';
    if (hour === 12) return '12p';
    if (hour < 12) return `${hour}a`;
    return `${hour - 12}p`;
  };

  const getMeetingsForHour = (hour) => {
    return schedule.meetings.filter(meeting => {
      const [startHour, startMin] = meeting.startTime.split(':').map(Number);
      // Only show in the hour it starts
      return startHour === hour;
    });
  };

  const getScheduledTasksForHour = (hour) => {
    const scheduledTasks = schedule.scheduledTasks || [];
    return scheduledTasks.filter(task => {
      const [startHour, startMin] = task.startTime.split(':').map(Number);
      // Only show in the hour it starts
      return startHour === hour;
    });
  };

  const calculateItemHeight = (startTime, endTime) => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const durationMinutes = endMinutes - startMinutes;

    // Convert duration to pixels (HOUR_HEIGHT = 60px per hour = 1px per minute)
    return (durationMinutes / 60) * HOUR_HEIGHT;
  };

  const calculateItemTop = (startTime, hour) => {
    const [startHour, startMin] = startTime.split(':').map(Number);

    // Calculate offset from the hour line
    const minuteOffset = startMin;
    return (minuteOffset / 60) * HOUR_HEIGHT;
  };

  const handleRemoveScheduledTask = (taskId) => {
    const updatedScheduledTasks = (schedule.scheduledTasks || []).filter(task => task.taskId !== taskId);
    onUpdateSchedule({
      ...schedule,
      scheduledTasks: updatedScheduledTasks
    });
  };

  const snapToQuarterHour = (minutes) => {
    // Round to nearest 15 minutes (0, 15, 30, 45)
    return Math.round(minutes / 15) * 15;
  };

  const handleDragStart = (item, dragStartY, itemTop) => {
    // Calculate offset from top of item to where user clicked
    const grabOffset = dragStartY - itemTop;
    setDraggedItem({ ...item, grabOffset });
  };

  const handleDragOver = (e, hour) => {
    e.preventDefault(); // Allow drop

    if (!draggedItem) return;

    // Calculate preview position
    const rect = e.currentTarget.getBoundingClientRect();
    const cursorY = e.clientY - rect.top; // Cursor position within the hour

    // Account for where user grabbed the item
    const grabOffset = draggedItem.grabOffset || 0;
    const itemTopY = cursorY - grabOffset; // Where the top of the item should be

    // Convert to minutes and snap
    const minuteOffset = (itemTopY / HOUR_HEIGHT) * 60;
    let snappedMinutes = snapToQuarterHour(minuteOffset);

    // Handle case where snapping results in 60 minutes or negative minutes
    let previewHour = hour;
    let previewMinutes = snappedMinutes;
    if (snappedMinutes >= 60) {
      previewHour = hour + 1;
      previewMinutes = 0;
    } else if (snappedMinutes < 0) {
      previewHour = hour - 1;
      previewMinutes = 60 + snappedMinutes;
    }

    // Calculate duration
    let durationMinutes = 0;
    if (draggedItem.type === 'meeting') {
      const [oldStartHour, oldStartMin] = draggedItem.data.startTime.split(':').map(Number);
      const [oldEndHour, oldEndMin] = draggedItem.data.endTime.split(':').map(Number);
      durationMinutes = (oldEndHour * 60 + oldEndMin) - (oldStartHour * 60 + oldStartMin);
    } else if (draggedItem.type === 'scheduledTask') {
      const [oldStartHour, oldStartMin] = draggedItem.data.startTime.split(':').map(Number);
      const [oldEndHour, oldEndMin] = draggedItem.data.endTime.split(':').map(Number);
      durationMinutes = (oldEndHour * 60 + oldEndMin) - (oldStartHour * 60 + oldStartMin);
    } else if (draggedItem.type === 'task') {
      // Default 30-minute duration for tasks from Today list
      durationMinutes = 30;
    }

    setDropPreview({
      hour: previewHour,
      startMinute: previewMinutes,
      durationMinutes
    });
  };

  const handleDrop = (e, hour) => {
    e.preventDefault();
    if (!draggedItem) return;

    // Calculate the new start time based on the drop position (snapped to 15 min)
    const rect = e.currentTarget.getBoundingClientRect();
    const cursorY = e.clientY - rect.top;

    // Account for where user grabbed the item
    const grabOffset = draggedItem.grabOffset || 0;
    const itemTopY = cursorY - grabOffset;

    const minuteOffset = (itemTopY / HOUR_HEIGHT) * 60;
    let snappedMinutes = snapToQuarterHour(minuteOffset);

    // Handle case where snapping results in 60 minutes (should be next hour, 0 minutes)
    // or negative minutes (should be previous hour)
    let newStartHour = hour;
    let newStartMin = snappedMinutes;
    if (snappedMinutes >= 60) {
      newStartHour = hour + 1;
      newStartMin = 0;
    } else if (snappedMinutes < 0) {
      newStartHour = hour - 1;
      newStartMin = 60 + snappedMinutes; // e.g., 60 + (-30) = 30
    }

    const newStartTime = `${String(newStartHour).padStart(2, '0')}:${String(newStartMin).padStart(2, '0')}`;

    if (draggedItem.type === 'meeting') {
      // Calculate duration and new end time
      const [oldStartHour, oldStartMin] = draggedItem.data.startTime.split(':').map(Number);
      const [oldEndHour, oldEndMin] = draggedItem.data.endTime.split(':').map(Number);
      const durationMinutes = (oldEndHour * 60 + oldEndMin) - (oldStartHour * 60 + oldStartMin);

      const newEndMinutes = (newStartHour * 60 + newStartMin) + durationMinutes;
      const newEndHour = Math.floor(newEndMinutes / 60);
      const newEndMin = newEndMinutes % 60;
      const newEndTime = `${String(newEndHour).padStart(2, '0')}:${String(newEndMin).padStart(2, '0')}`;

      // Update meeting
      const updatedMeetings = schedule.meetings.map(m =>
        m.id === draggedItem.data.id
          ? { ...m, startTime: newStartTime, endTime: newEndTime }
          : m
      );
      onUpdateSchedule({ ...schedule, meetings: updatedMeetings });
    } else if (draggedItem.type === 'scheduledTask') {
      // Calculate duration and new end time
      const [oldStartHour, oldStartMin] = draggedItem.data.startTime.split(':').map(Number);
      const [oldEndHour, oldEndMin] = draggedItem.data.endTime.split(':').map(Number);
      const durationMinutes = (oldEndHour * 60 + oldEndMin) - (oldStartHour * 60 + oldStartMin);

      const newEndMinutes = (newStartHour * 60 + newStartMin) + durationMinutes;
      const newEndHour = Math.floor(newEndMinutes / 60);
      const newEndMin = newEndMinutes % 60;
      const newEndTime = `${String(newEndHour).padStart(2, '0')}:${String(newEndMin).padStart(2, '0')}`;

      // Update scheduled task
      const updatedScheduledTasks = (schedule.scheduledTasks || []).map(t =>
        t.taskId === draggedItem.data.taskId
          ? { ...t, startTime: newStartTime, endTime: newEndTime }
          : t
      );
      onUpdateSchedule({ ...schedule, scheduledTasks: updatedScheduledTasks });
    } else if (draggedItem.type === 'task') {
      // Create new scheduled task from Today task with 30-minute default duration
      const task = draggedItem.data;

      // Calculate 30-minute duration
      const startMinutes = (newStartHour * 60 + newStartMin);
      const endMinutes = startMinutes + 30; // 30-minute default
      const newEndHour = Math.floor(endMinutes / 60);
      const newEndMin = endMinutes % 60;
      const newEndTime = `${String(newEndHour).padStart(2, '0')}:${String(newEndMin).padStart(2, '0')}`;

      const scheduledTask = {
        taskId: task.id,
        taskTitle: task.title,
        startTime: newStartTime,
        endTime: newEndTime
      };

      const updatedScheduledTasks = [...(schedule.scheduledTasks || []), scheduledTask];
      onUpdateSchedule({ ...schedule, scheduledTasks: updatedScheduledTasks });
    }

    setDraggedItem(null);
    setDropPreview(null);
  };

  const handleDragLeave = () => {
    setDropPreview(null);
  };

  const handleResizeStart = (item) => {
    setResizingItem(item);
  };

  const handleResizeDragOver = (e, hour) => {
    e.preventDefault();
    if (!resizingItem) return;

    // Calculate the mouse position within the hour
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const minuteOffset = (offsetY / HOUR_HEIGHT) * 60;
    let snappedMinutes = snapToQuarterHour(minuteOffset);

    // Handle case where snapping results in 60 minutes or negative minutes
    let adjustedHour = hour;
    let adjustedMinutes = snappedMinutes;
    if (snappedMinutes >= 60) {
      adjustedHour = hour + 1;
      adjustedMinutes = 0;
    } else if (snappedMinutes < 0) {
      adjustedHour = hour - 1;
      adjustedMinutes = 60 + snappedMinutes;
    }

    const currentStartHour = resizingItem.edge === 'top' ? adjustedHour : parseInt(resizingItem.data.startTime.split(':')[0]);
    const currentStartMin = resizingItem.edge === 'top' ? adjustedMinutes : parseInt(resizingItem.data.startTime.split(':')[1]);
    const currentEndHour = resizingItem.edge === 'bottom' ? adjustedHour : parseInt(resizingItem.data.endTime.split(':')[0]);
    const currentEndMin = resizingItem.edge === 'bottom' ? adjustedMinutes : parseInt(resizingItem.data.endTime.split(':')[1]);

    const startMinutes = currentStartHour * 60 + currentStartMin;
    const endMinutes = currentEndHour * 60 + currentEndMin;
    const durationMinutes = endMinutes - startMinutes;

    // Prevent negative or zero duration
    if (durationMinutes <= 0) return;

    // For bottom edge resize, preview should start at original start position
    // For top edge resize, preview should start at new start position
    setDropPreview({
      hour: currentStartHour,
      startMinute: currentStartMin,
      durationMinutes,
      isResize: true,
      resizeEdge: resizingItem.edge
    });
  };

  const handleResizeDrop = (e, hour) => {
    e.preventDefault();
    if (!resizingItem) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const minuteOffset = (offsetY / HOUR_HEIGHT) * 60;
    let snappedMinutes = snapToQuarterHour(minuteOffset);

    // Handle case where snapping results in 60 minutes or negative minutes
    let adjustedHour = hour;
    let adjustedMinutes = snappedMinutes;
    if (snappedMinutes >= 60) {
      adjustedHour = hour + 1;
      adjustedMinutes = 0;
    } else if (snappedMinutes < 0) {
      adjustedHour = hour - 1;
      adjustedMinutes = 60 + snappedMinutes;
    }

    if (resizingItem.type === 'meeting') {
      const meeting = resizingItem.data;
      let newStartTime = meeting.startTime;
      let newEndTime = meeting.endTime;

      if (resizingItem.edge === 'top') {
        // Dragging top edge - change start time
        newStartTime = `${String(adjustedHour).padStart(2, '0')}:${String(adjustedMinutes).padStart(2, '0')}`;

        // Ensure start is before end
        const [newStartHour, newStartMin] = newStartTime.split(':').map(Number);
        const [endHour, endMin] = newEndTime.split(':').map(Number);
        if ((newStartHour * 60 + newStartMin) >= (endHour * 60 + endMin)) {
          setResizingItem(null);
          setDropPreview(null);
          return;
        }
      } else {
        // Dragging bottom edge - change end time
        newEndTime = `${String(adjustedHour).padStart(2, '0')}:${String(adjustedMinutes).padStart(2, '0')}`;

        // Ensure end is after start
        const [startHour, startMin] = newStartTime.split(':').map(Number);
        const [newEndHour, newEndMin] = newEndTime.split(':').map(Number);
        if ((newEndHour * 60 + newEndMin) <= (startHour * 60 + startMin)) {
          setResizingItem(null);
          setDropPreview(null);
          return;
        }
      }

      const updatedMeetings = schedule.meetings.map(m =>
        m.id === meeting.id
          ? { ...m, startTime: newStartTime, endTime: newEndTime }
          : m
      );
      onUpdateSchedule({ ...schedule, meetings: updatedMeetings });
    } else if (resizingItem.type === 'scheduledTask') {
      const task = resizingItem.data;
      let newStartTime = task.startTime;
      let newEndTime = task.endTime;

      if (resizingItem.edge === 'top') {
        // Dragging top edge - change start time
        newStartTime = `${String(adjustedHour).padStart(2, '0')}:${String(adjustedMinutes).padStart(2, '0')}`;

        // Ensure start is before end
        const [newStartHour, newStartMin] = newStartTime.split(':').map(Number);
        const [endHour, endMin] = newEndTime.split(':').map(Number);
        if ((newStartHour * 60 + newStartMin) >= (endHour * 60 + endMin)) {
          setResizingItem(null);
          setDropPreview(null);
          return;
        }
      } else {
        // Dragging bottom edge - change end time
        newEndTime = `${String(adjustedHour).padStart(2, '0')}:${String(adjustedMinutes).padStart(2, '0')}`;

        // Ensure end is after start
        const [startHour, startMin] = newStartTime.split(':').map(Number);
        const [newEndHour, newEndMin] = newEndTime.split(':').map(Number);
        if ((newEndHour * 60 + newEndMin) <= (startHour * 60 + startMin)) {
          setResizingItem(null);
          setDropPreview(null);
          return;
        }
      }

      const updatedScheduledTasks = (schedule.scheduledTasks || []).map(t =>
        t.taskId === task.taskId
          ? { ...t, startTime: newStartTime, endTime: newEndTime }
          : t
      );
      onUpdateSchedule({ ...schedule, scheduledTasks: updatedScheduledTasks });
    }

    setResizingItem(null);
    setDropPreview(null);
  };

  const getCurrentTimePosition = () => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();

    if (hours < START_HOUR || hours > END_HOUR) {
      return null;
    }

    const hoursSinceStart = hours - START_HOUR;
    const minutesFraction = minutes / 60;
    const position = (hoursSinceStart + minutesFraction) * HOUR_HEIGHT;

    return position;
  };

  const getUnscheduledTasks = () => {
    if (!todayTasks || !Array.isArray(todayTasks)) return [];

    const scheduledTaskIds = new Set((schedule.scheduledTasks || []).map(st => st.taskId));
    return todayTasks.filter(task => !scheduledTaskIds.has(task.id));
  };

  const unscheduledTasks = getUnscheduledTasks();

  const hours = [];
  for (let i = START_HOUR; i <= END_HOUR; i++) {
    hours.push(i);
  }

  const currentTimePosition = getCurrentTimePosition();

  return (
    <div className="w-80 bg-dark-surface border-l border-dark-border flex flex-col h-full shadow-glass-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-dark-border bg-dark-elevated">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-text-secondary hover:text-text-primary"
            >
              <svg
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <h3 className="font-semibold text-text-primary">Today's Schedule</h3>
          </div>
          <button
            onClick={() => {
              setEditingMeeting(null);
              setShowAddModal(true);
            }}
            className="p-1.5 text-primary-400 hover:text-primary-300 hover:bg-dark-hover rounded transition-colors"
            title="Add meeting"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <div className="text-xs text-text-tertiary mt-1">
          {schedule.meetings.length} meeting{schedule.meetings.length !== 1 ? 's' : ''} • {(schedule.scheduledTasks || []).length} task{(schedule.scheduledTasks || []).length !== 1 ? 's' : ''} • {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Unscheduled Tasks Section */}
          {unscheduledTasks.length > 0 && (
            <div className="border-b border-dark-border bg-dark-base/50">
              <div className="px-4 py-2">
                <button
                  onClick={() => setShowUnscheduled(!showUnscheduled)}
                  className="flex items-center gap-2 w-full text-left"
                >
                  <svg
                    className={`w-3 h-3 transition-transform text-text-secondary ${showUnscheduled ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                    Unscheduled Tasks ({unscheduledTasks.length})
                  </h4>
                </button>
              </div>

              {showUnscheduled && (
                <div className="px-3 pb-3 space-y-2 max-h-48 overflow-y-auto">
                  {unscheduledTasks.map(task => (
                    <div
                      key={task.id}
                      className="bg-warning-500/10 border-l-4 border-warning-500 p-2 rounded hover:bg-warning-500/20 transition-all cursor-move group relative"
                      style={{ height: '30px' }}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', task.id);

                        const rect = e.currentTarget.getBoundingClientRect();
                        const grabY = e.clientY;
                        const itemTop = rect.top;
                        handleDragStart({ type: 'task', data: task }, grabY, itemTop);
                      }}
                    >
                      <div className="flex items-center justify-between h-full">
                        <span className="text-xs font-medium text-text-primary truncate flex-1">
                          {task.title}
                        </span>
                        <span className="text-xs text-warning-400 ml-2">
                          30m
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Timeline Grid */}
          <div className="flex-1 overflow-y-auto px-3 py-2 relative">
            {schedule.meetings.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <div className="text-center py-8">
                  <div className="text-text-tertiary/30 mb-2">
                    <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-xs text-text-tertiary">Click hour to add meeting</p>
                </div>
              </div>
            )}

            <div className="relative">
              {hours.map((hour) => {
                const hourMeetings = getMeetingsForHour(hour);
                const hourScheduledTasks = getScheduledTasksForHour(hour);
                const isLastHour = hour === END_HOUR;
                const hasItems = hourMeetings.length > 0 || hourScheduledTasks.length > 0;

                return (
                  <div key={hour} className="relative" style={{ height: `${HOUR_HEIGHT}px` }}>
                    {/* Hour label */}
                    <div className="absolute left-0 -top-2 w-10 text-xs font-medium text-text-secondary">
                      {formatHour(hour)}
                    </div>

                    {/* Clickable hour slot */}
                    <div
                      className="ml-12 border-t border-dark-border hover:bg-primary-500/10 transition-colors cursor-pointer relative"
                      style={{ height: `${HOUR_HEIGHT}px` }}
                      onClick={() => handleHourClick(hour)}
                      onDragOver={(e) => {
                        if (resizingItem) {
                          handleResizeDragOver(e, hour);
                        } else {
                          handleDragOver(e, hour);
                        }
                      }}
                      onDrop={(e) => {
                        if (resizingItem) {
                          handleResizeDrop(e, hour);
                        } else {
                          handleDrop(e, hour);
                        }
                      }}
                      onDragLeave={handleDragLeave}
                    >
                      {/* 30-min subdivision line */}
                      {!isLastHour && (
                        <div className="absolute left-0 right-0 border-t border-dark-border/50"
                          style={{ top: `${HOUR_HEIGHT / 2}px` }}
                        />
                      )}

                      {/* Drop Preview Indicator */}
                      {dropPreview && dropPreview.hour === hour && (
                        <div
                          className="absolute left-0 right-0 bg-primary-500/20 border-2 border-primary-400/50 border-dashed rounded opacity-70 pointer-events-none"
                          style={{
                            top: `${(dropPreview.startMinute / 60) * HOUR_HEIGHT}px`,
                            height: `${(dropPreview.durationMinutes / 60) * HOUR_HEIGHT}px`
                          }}
                        />
                      )}

                      {/* Meetings and Scheduled Tasks */}
                      {hasItems && (
                        <div className="relative z-10" onClick={(e) => e.stopPropagation()}>
                          {hourMeetings.map(meeting => {
                            const height = calculateItemHeight(meeting.startTime, meeting.endTime);
                            const top = calculateItemTop(meeting.startTime, hour);
                            return (
                              <div
                                key={meeting.id}
                                className="absolute left-1 right-1"
                                style={{ top: `${top}px`, height: `${height}px` }}
                              >
                                <MeetingBlock
                                  meeting={meeting}
                                  onEdit={handleEditMeeting}
                                  onDelete={handleDeleteMeeting}
                                  onDragStart={handleDragStart}
                                  onResizeStart={handleResizeStart}
                                />
                              </div>
                            );
                          })}
                          {hourScheduledTasks.map(task => {
                            const height = calculateItemHeight(task.startTime, task.endTime);
                            const top = calculateItemTop(task.startTime, hour);
                            return (
                              <div
                                key={task.taskId}
                                className="absolute left-1 right-1"
                                style={{ top: `${top}px`, height: `${height}px` }}
                              >
                                <ScheduledTaskBlock
                                  scheduledTask={task}
                                  onRemove={handleRemoveScheduledTask}
                                  onDragStart={handleDragStart}
                                  onResizeStart={handleResizeStart}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Current time indicator */}
              {currentTimePosition !== null && (
                <div
                  className="absolute left-12 right-0 z-20 pointer-events-none"
                  style={{ top: `${currentTimePosition}px` }}
                >
                  <div className="flex items-center">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full -ml-1" />
                    <div className="flex-1 border-t-2 border-red-500" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Current Time Footer */}
          <div className="px-4 py-2 border-t border-dark-border bg-dark-elevated">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-tertiary">Current time</span>
              <span className="font-mono font-medium text-primary-400">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Add/Edit Meeting Modal */}
      <AddMeetingModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingMeeting(null);
        }}
        onSave={handleSaveMeeting}
        meeting={editingMeeting}
      />
    </div>
  );
}

export default ScheduleSidebar;
