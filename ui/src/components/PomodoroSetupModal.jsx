import React, { useState, useEffect } from 'react';

function PomodoroSetupModal({ isOpen, onClose, onStart, currentFocusTask, todayTasks, meetings }) {
  const [durationType, setDurationType] = useState('25'); // '25', '50', or 'custom'
  const [customDuration, setCustomDuration] = useState('');
  const [mode, setMode] = useState('task'); // 'task' or 'freetext'
  const [selectedTaskId, setSelectedTaskId] = useState(currentFocusTask?.id || '');
  const [freeTextTitle, setFreeTextTitle] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (currentFocusTask) {
      setSelectedTaskId(currentFocusTask.id);
      setMode('task');
    }
  }, [currentFocusTask]);

  const handleStart = () => {
    let task;
    let durationInMinutes;

    // Calculate duration
    if (durationType === 'custom') {
      const customMins = parseInt(customDuration);
      if (!customDuration || isNaN(customMins) || customMins <= 0) {
        alert('Please enter a valid duration in minutes');
        return;
      }
      durationInMinutes = customMins;
    } else {
      durationInMinutes = parseInt(durationType);
    }

    if (mode === 'task') {
      if (!selectedTaskId) {
        alert('Please select a task or meeting to focus on');
        return;
      }

      // Check if it's a task or meeting
      task = todayTasks.find(t => t.id === selectedTaskId);

      if (!task) {
        // It's a meeting
        const meeting = meetings.find(m => m.id === selectedTaskId);
        if (meeting) {
          // Convert meeting to task-like object
          task = {
            id: meeting.id,
            title: meeting.title,
            deadline: 'none',
            target_date: 'none',
            notes: meeting.notes ? [meeting.notes] : []
          };
        }
      }
    } else {
      // Free text mode
      if (!freeTextTitle.trim()) {
        alert('Please enter what you want to focus on');
        return;
      }
      // Create a temporary task object for display
      task = {
        id: 'adhoc-' + Date.now(),
        title: freeTextTitle,
        deadline: 'none',
        target_date: 'none',
        notes: []
      };
    }

    onStart({
      duration: durationInMinutes * 60, // Convert to seconds
      task,
      notes
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-elevated rounded-lg p-6 w-full max-w-lg shadow-xl">
        <h2 className="text-2xl font-bold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-3xl">🍅</span>
          Start Pomodoro
        </h2>

        {/* Duration Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Duration
          </label>
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setDurationType('25')}
              className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                durationType === '25'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-dark-border hover:border-dark-hover'
              }`}
            >
              25 min
            </button>
            <button
              onClick={() => setDurationType('50')}
              className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                durationType === '50'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-dark-border hover:border-dark-hover'
              }`}
            >
              50 min
            </button>
            <button
              onClick={() => setDurationType('custom')}
              className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                durationType === 'custom'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-dark-border hover:border-dark-hover'
              }`}
            >
              Custom
            </button>
          </div>
          {durationType === 'custom' && (
            <input
              type="number"
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
              placeholder="Minutes"
              min="1"
              className="w-full px-3 py-2 bg-dark-base border border-dark-border text-text-primary placeholder-text-tertiary rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          )}
        </div>

        {/* Mode Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-text-secondary mb-2">
            What will you focus on?
          </label>
          <div className="flex gap-4 mb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="task"
                checked={mode === 'task'}
                onChange={(e) => setMode(e.target.value)}
                className="w-4 h-4 text-primary-600"
              />
              <span className="text-sm text-text-primary">Today's Task</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="freetext"
                checked={mode === 'freetext'}
                onChange={(e) => setMode(e.target.value)}
                className="w-4 h-4 text-primary-600"
              />
              <span className="text-sm text-text-primary">Ad-hoc Focus</span>
            </label>
          </div>

          {mode === 'task' ? (
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="w-full px-3 py-2 bg-dark-base border border-dark-border text-text-primary rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select a task or meeting...</option>

              {todayTasks.length > 0 && (
                <optgroup label="📋 Today's Tasks">
                  {todayTasks.map(task => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </optgroup>
              )}

              {meetings && meetings.length > 0 && (
                <optgroup label="📅 Today's Meetings">
                  {meetings.map(meeting => (
                    <option key={meeting.id} value={meeting.id}>
                      {meeting.title}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          ) : (
            <input
              type="text"
              value={freeTextTitle}
              onChange={(e) => setFreeTextTitle(e.target.value)}
              placeholder="What do you want to work on?"
              className="w-full px-3 py-2 bg-dark-base border border-dark-border text-text-primary placeholder-text-tertiary rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              autoFocus
            />
          )}
        </div>

        {/* Additional Notes */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Session Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What will you focus on during this session?"
            className="w-full px-3 py-2 bg-dark-base border border-dark-border text-text-primary placeholder-text-tertiary rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-dark-hover text-text-secondary rounded-lg hover:bg-dark-border transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            className="flex-1 px-4 py-2 bg-error-500 text-white rounded-lg hover:bg-error-600 transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-lg">🍅</span>
            Start Focus
          </button>
        </div>
      </div>
    </div>
  );
}

export default PomodoroSetupModal;
