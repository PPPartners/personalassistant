import React, { useState, useEffect } from 'react';

function AddMeetingModal({ isOpen, onClose, onSave, meeting, initialTime }) {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('09:30');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (meeting) {
        // Editing existing meeting
        setTitle(meeting.title);
        setStartTime(meeting.startTime);
        setEndTime(meeting.endTime);
        setNotes(meeting.notes || '');
      } else if (initialTime) {
        // Creating new meeting at specific time
        setTitle('');
        setStartTime(initialTime);
        // Default to 30 minute meeting
        const [hours, minutes] = initialTime.split(':').map(Number);
        const endMinutes = hours * 60 + minutes + 30;
        const endHours = Math.floor(endMinutes / 60) % 24;
        const endMins = endMinutes % 60;
        setEndTime(`${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`);
        setNotes('');
      } else {
        // Creating new meeting with defaults
        setTitle('');
        setStartTime('09:00');
        setEndTime('09:30');
        setNotes('');
      }
    }
  }, [isOpen, meeting, initialTime]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation
    if (!title.trim()) {
      alert('Please enter a meeting title');
      return;
    }

    if (startTime >= endTime) {
      alert('End time must be after start time');
      return;
    }

    const meetingData = {
      id: meeting?.id || `m-${Date.now()}`,
      title: title.trim(),
      startTime,
      endTime,
      notes: notes.trim()
    };

    onSave(meetingData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-elevated rounded-lg shadow-xl max-w-md w-full">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-dark-border">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-text-primary">
                {meeting ? 'Edit Meeting' : 'Add Meeting'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="text-text-tertiary hover:text-text-secondary transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Meeting Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Team standup, Client call, etc."
                className="w-full px-3 py-2 bg-dark-base border border-dark-border text-text-primary placeholder-text-tertiary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-base border border-dark-border text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  End Time *
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-base border border-dark-border text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Meeting link, agenda, etc."
                rows={3}
                className="w-full px-3 py-2 bg-dark-base border border-dark-border text-text-primary placeholder-text-tertiary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-dark-border flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
            >
              {meeting ? 'Update' : 'Add'} Meeting
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddMeetingModal;
