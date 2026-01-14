import React, { useState } from 'react';
import { formatDeadline } from '../utils/dateUtils';

function RestoreTaskModal({ isOpen, onClose, task, onRestore }) {
  const [destination, setDestination] = useState('backlog');

  const handleSubmit = (e) => {
    e.preventDefault();
    onRestore(task, destination);
    onClose();
  };

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-elevated rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-border bg-gradient-to-r from-green-500 to-emerald-500">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">♻️</span>
              Restore Task
            </h2>
            <button
              onClick={onClose}
              className="text-white hover:text-green-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          {/* Task Preview */}
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-semibold text-neutral-800 mb-2">{task.title}</h3>
            <div className="space-y-1 text-sm text-neutral-600">
              {task.deadline !== 'none' && (
                <div>⏰ Deadline: {formatDeadline(task.deadline)}</div>
              )}
              {task.target_date !== 'none' && (
                <div>🎯 Target: {formatDeadline(task.target_date)}</div>
              )}
              {task.completed_date && (
                <div className="text-green-700 font-medium">
                  ✓ Completed: {formatDeadline(task.completed_date)}
                </div>
              )}
            </div>
          </div>

          {/* Destination Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-3">
              Restore to: <span className="text-danger-500">*</span>
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 border-dark-border transition-all hover:border-green-300 has-[:checked]:border-green-500 has-[:checked]:bg-green-50">
                <input
                  type="radio"
                  name="destination"
                  value="today"
                  checked={destination === 'today'}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-4 h-4 text-green-600"
                />
                <div className="flex-1">
                  <div className="font-medium text-text-primary">Today</div>
                  <div className="text-xs text-text-tertiary">Add to today's tasks</div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 border-dark-border transition-all hover:border-green-300 has-[:checked]:border-green-500 has-[:checked]:bg-green-50">
                <input
                  type="radio"
                  name="destination"
                  value="dueSoon"
                  checked={destination === 'dueSoon'}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-4 h-4 text-green-600"
                />
                <div className="flex-1">
                  <div className="font-medium text-text-primary">Due Soon</div>
                  <div className="text-xs text-text-tertiary">Add to upcoming tasks</div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 border-dark-border transition-all hover:border-green-300 has-[:checked]:border-green-500 has-[:checked]:bg-green-50">
                <input
                  type="radio"
                  name="destination"
                  value="backlog"
                  checked={destination === 'backlog'}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-4 h-4 text-green-600"
                />
                <div className="flex-1">
                  <div className="font-medium text-text-primary">Backlog</div>
                  <div className="text-xs text-text-tertiary">Save for later</div>
                </div>
              </label>
            </div>
          </div>

          {/* Info Note */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-medium">Note:</span> Task will be restored with status "open" and completion date removed.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-dark-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all font-medium"
            >
              Restore Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RestoreTaskModal;
