import React, { useState, useEffect } from 'react';

function PromoteIdeaModal({ isOpen, onClose, idea, onPromote }) {
  const [title, setTitle] = useState('');
  const [dateType, setDateType] = useState('target');
  const [selectedDate, setSelectedDate] = useState('');
  const [destination, setDestination] = useState('backlog');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && idea) {
      // Pre-fill title from idea
      setTitle(idea.text);
      setDateType('target');
      setSelectedDate('');
      setDestination('backlog');
      setError('');
    }
  }, [isOpen, idea]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    // Validate title
    if (!title.trim()) {
      setError('Please enter a task title');
      return;
    }

    // Validate date
    if (!selectedDate) {
      setError('Please select a date');
      return;
    }

    // Create task data
    const taskData = {
      title: title.trim(),
      deadline: dateType === 'deadline' ? selectedDate : 'none',
      target_date: dateType === 'target' ? selectedDate : 'none',
      notes: idea.details || []
    };

    onPromote(idea, taskData, destination);
    onClose();
  };

  if (!isOpen || !idea) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-elevated rounded-lg shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-border bg-gradient-to-r from-purple-500 to-pink-500">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">💡→📋</span>
              Promote Idea to Task
            </h2>
            <button
              onClick={onClose}
              className="text-white hover:text-purple-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
              {error}
            </div>
          )}

          {/* Title Input */}
          <div className="mb-4">
            <label htmlFor="task-title" className="block text-sm font-medium text-text-secondary mb-2">
              Task Title <span className="text-danger-500">*</span>
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-dark-base border border-dark-border text-text-primary placeholder-text-tertiary rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Idea Details Preview */}
          {idea.details && idea.details.length > 0 && (
            <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-xs font-medium text-purple-700 mb-2">Will be added as notes:</p>
              <ul className="text-sm text-purple-900 space-y-1">
                {idea.details.map((detail, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-purple-500 mt-0.5">•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Date Type Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Date Type <span className="text-danger-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border-2 border-dark-border transition-all hover:border-purple-300 has-[:checked]:border-purple-500 has-[:checked]:bg-purple-50">
                <input
                  type="radio"
                  name="dateType"
                  value="target"
                  checked={dateType === 'target'}
                  onChange={(e) => setDateType(e.target.value)}
                  className="w-4 h-4 text-purple-600"
                />
                <div className="text-sm">
                  <div className="font-medium text-text-primary">Target Date</div>
                  <div className="text-xs text-text-tertiary">Soft goal</div>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border-2 border-dark-border transition-all hover:border-purple-300 has-[:checked]:border-purple-500 has-[:checked]:bg-purple-50">
                <input
                  type="radio"
                  name="dateType"
                  value="deadline"
                  checked={dateType === 'deadline'}
                  onChange={(e) => setDateType(e.target.value)}
                  className="w-4 h-4 text-purple-600"
                />
                <div className="text-sm">
                  <div className="font-medium text-text-primary">Deadline</div>
                  <div className="text-xs text-text-tertiary">Hard date</div>
                </div>
              </label>
            </div>
          </div>

          {/* Date Picker */}
          <div className="mb-4">
            <label htmlFor="task-date" className="block text-sm font-medium text-text-secondary mb-2">
              {dateType === 'deadline' ? 'Deadline Date' : 'Target Date'} <span className="text-danger-500">*</span>
            </label>
            <input
              id="task-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 bg-dark-base border border-dark-border text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent [color-scheme:dark]"
            />
          </div>

          {/* Destination Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Add To <span className="text-danger-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex items-center justify-center gap-2 cursor-pointer p-3 rounded-lg border-2 border-dark-border transition-all hover:border-purple-300 has-[:checked]:border-purple-500 has-[:checked]:bg-purple-50">
                <input
                  type="radio"
                  name="destination"
                  value="today"
                  checked={destination === 'today'}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-4 h-4 text-purple-600"
                />
                <span className="text-sm font-medium text-text-primary">Today</span>
              </label>

              <label className="flex items-center justify-center gap-2 cursor-pointer p-3 rounded-lg border-2 border-dark-border transition-all hover:border-purple-300 has-[:checked]:border-purple-500 has-[:checked]:bg-purple-50">
                <input
                  type="radio"
                  name="destination"
                  value="dueSoon"
                  checked={destination === 'dueSoon'}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-4 h-4 text-purple-600"
                />
                <span className="text-sm font-medium text-text-primary">Due Soon</span>
              </label>

              <label className="flex items-center justify-center gap-2 cursor-pointer p-3 rounded-lg border-2 border-dark-border transition-all hover:border-purple-300 has-[:checked]:border-purple-500 has-[:checked]:bg-purple-50">
                <input
                  type="radio"
                  name="destination"
                  value="backlog"
                  checked={destination === 'backlog'}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-4 h-4 text-purple-600"
                />
                <span className="text-sm font-medium text-text-primary">Backlog</span>
              </label>
            </div>
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
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-medium"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PromoteIdeaModal;
