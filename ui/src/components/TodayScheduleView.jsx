import React, { useState, useEffect, useRef } from 'react';
import MeetingBlock from './MeetingBlock';
import AddMeetingModal from './AddMeetingModal';

function TodayScheduleView({ schedule, onUpdateSchedule }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const timelineRef = useRef(null);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const START_HOUR = 7;  // 7 AM
  const END_HOUR = 20;    // 8 PM
  const HOUR_HEIGHT = 80; // pixels per hour

  const hours = [];
  for (let i = START_HOUR; i <= END_HOUR; i++) {
    hours.push(i);
  }

  const formatHour = (hour) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  const handleHourClick = (hour) => {
    const time = `${String(hour).padStart(2, '0')}:00`;
    setSelectedTime(time);
    setEditingMeeting(null);
    setShowAddModal(true);
  };

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
    setSelectedTime(null);
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

  // Calculate current time indicator position
  const getCurrentTimePosition = () => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();

    if (hours < START_HOUR || hours > END_HOUR) {
      return null; // Outside visible hours
    }

    const hoursSinceStart = hours - START_HOUR;
    const minutesFraction = minutes / 60;
    const position = (hoursSinceStart + minutesFraction) * HOUR_HEIGHT;

    return position;
  };

  // Get meetings for a specific hour
  const getMeetingsForHour = (hour) => {
    return schedule.meetings.filter(meeting => {
      const [meetingHour] = meeting.startTime.split(':').map(Number);
      return meetingHour === hour;
    });
  };

  const currentTimePosition = getCurrentTimePosition();

  return (
    <div className="h-full bg-neutral-50 flex">
      {/* Main Timeline */}
      <div className="flex-1 overflow-y-auto" ref={timelineRef}>
        <div className="max-w-4xl mx-auto p-6">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-neutral-800">
                Today - {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h2>
              <p className="text-neutral-600 mt-1">
                {schedule.meetings.length} meeting{schedule.meetings.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedTime(null);
                setEditingMeeting(null);
                setShowAddModal(true);
              }}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Meeting
            </button>
          </div>

          {/* Timeline */}
          <div className="relative">
            {hours.map((hour) => {
              const hourMeetings = getMeetingsForHour(hour);
              const isLastHour = hour === END_HOUR;

              return (
                <div key={hour} className="relative" style={{ height: `${HOUR_HEIGHT}px` }}>
                  {/* Hour label */}
                  <div className="absolute left-0 -top-3 w-20 text-sm font-medium text-neutral-600">
                    {formatHour(hour)}
                  </div>

                  {/* Clickable hour slot */}
                  <div
                    className="ml-24 border-t border-neutral-200 hover:bg-primary-50/30 transition-colors cursor-pointer group relative"
                    style={{ height: `${HOUR_HEIGHT}px` }}
                    onClick={() => handleHourClick(hour)}
                  >
                    {/* 30-min subdivision line */}
                    {!isLastHour && (
                      <div className="absolute left-0 right-0 border-t border-neutral-100"
                        style={{ top: `${HOUR_HEIGHT / 2}px` }}
                      />
                    )}

                    {/* Hover hint */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                      <span className="text-xs text-primary-600 font-medium bg-white px-2 py-1 rounded shadow-sm">
                        + Add meeting
                      </span>
                    </div>

                    {/* Meetings */}
                    {hourMeetings.length > 0 && (
                      <div className="p-2 space-y-2 relative z-10" onClick={(e) => e.stopPropagation()}>
                        {hourMeetings.map(meeting => (
                          <MeetingBlock
                            key={meeting.id}
                            meeting={meeting}
                            onEdit={handleEditMeeting}
                            onDelete={handleDeleteMeeting}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Current time indicator */}
            {currentTimePosition !== null && (
              <div
                className="absolute left-24 right-0 z-20 pointer-events-none"
                style={{ top: `${currentTimePosition}px` }}
              >
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-red-500 rounded-full -ml-1" />
                  <div className="flex-1 border-t-2 border-red-500" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Meeting Modal */}
      <AddMeetingModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingMeeting(null);
          setSelectedTime(null);
        }}
        onSave={handleSaveMeeting}
        meeting={editingMeeting}
        initialTime={selectedTime}
      />
    </div>
  );
}

export default TodayScheduleView;
