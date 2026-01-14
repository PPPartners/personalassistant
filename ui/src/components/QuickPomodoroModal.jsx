import React, { useState } from 'react';

function QuickPomodoroModal({ isOpen, onClose, task, onStart }) {
  const [durationType, setDurationType] = useState('25');
  const [customDuration, setCustomDuration] = useState('');

  if (!isOpen || !task) return null;

  const handleStart = () => {
    let durationInMinutes;

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

    onStart({
      duration: durationInMinutes * 60, // Convert to seconds
      task,
      notes: ''
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-elevated rounded-lg p-6 w-full max-w-md shadow-xl">
        <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-2xl">🍅</span>
          Start Pomodoro
        </h2>

        <div className="mb-4">
          <p className="text-sm text-text-secondary mb-3">
            Focus on: <span className="font-semibold text-text-primary">{task.title}</span>
          </p>

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
              autoFocus
            />
          )}
        </div>

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
            Start
          </button>
        </div>
      </div>
    </div>
  );
}

export default QuickPomodoroModal;
