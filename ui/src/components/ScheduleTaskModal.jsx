import React, { useState, useEffect } from 'react';

function ScheduleTaskModal({ isOpen, onClose, onSchedule, task }) {
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(30); // in minutes

  useEffect(() => {
    if (isOpen) {
      setStartTime('09:00');
      setDuration(30);
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Calculate end time
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + duration;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

    onSchedule({
      taskId: task.id,
      taskTitle: task.title,
      startTime,
      endTime,
      duration
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-elevated rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-text-primary mb-4">Schedule Task</h2>

        <div className="mb-4 p-3 bg-dark-hover rounded border border-dark-border">
          <p className="text-sm font-medium text-text-primary">{task?.title}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Start Time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 bg-dark-base border border-dark-border text-text-primary rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Duration
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full px-3 py-2 bg-dark-base border border-dark-border text-text-primary rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
              <option value={180}>3 hours</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-dark-border text-text-secondary rounded hover:bg-dark-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors font-medium"
            >
              Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ScheduleTaskModal;
