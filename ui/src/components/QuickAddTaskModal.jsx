import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';

function QuickAddTaskModal({ isOpen, onClose, onAdd }) {
  const [title, setTitle] = useState('');
  const [dateType, setDateType] = useState('target'); // 'none', 'deadline', 'target'
  const [selectedDate, setSelectedDate] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const titleInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setTitle('');
      setDateType('target');
      setSelectedDate('');
      setDescription('');
      setError('');

      // Focus title input
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    // Validate title
    if (!title.trim()) {
      setError('Please enter a task title');
      return;
    }

    // Validate date requirement (per CLAUDE.md)
    if (dateType === 'none') {
      setError('Please select either a deadline or target date');
      return;
    }

    // Validate date is provided if type is selected
    if ((dateType === 'deadline' || dateType === 'target') && !selectedDate) {
      setError('Please select a date');
      return;
    }

    // Create task data
    const taskData = {
      title: title.trim(),
      deadline: dateType === 'deadline' ? selectedDate : 'none',
      target_date: dateType === 'target' ? selectedDate : 'none',
      notes: description.trim() ? [description.trim()] : []
    };

    onAdd(taskData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-elevated rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <span className="text-2xl">➕</span>
              Quick Add Task
            </h2>
            <button
              onClick={onClose}
              className="text-text-tertiary hover:text-text-secondary transition-colors"
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
              ref={titleInputRef}
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you need to do?"
              className="w-full px-3 py-2 bg-dark-base border border-dark-border text-text-primary placeholder-text-tertiary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Date Type Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Date Type <span className="text-danger-500">*</span>
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-dark-hover">
                <input
                  type="radio"
                  name="dateType"
                  value="target"
                  checked={dateType === 'target'}
                  onChange={(e) => setDateType(e.target.value)}
                  className="w-4 h-4 text-primary-600"
                />
                <div>
                  <div className="font-medium text-sm text-text-primary">Target Date (Recommended)</div>
                  <div className="text-xs text-text-tertiary">Soft goal - when you'd like to complete this</div>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-dark-hover">
                <input
                  type="radio"
                  name="dateType"
                  value="deadline"
                  checked={dateType === 'deadline'}
                  onChange={(e) => setDateType(e.target.value)}
                  className="w-4 h-4 text-primary-600"
                />
                <div>
                  <div className="font-medium text-sm text-text-primary">Deadline</div>
                  <div className="text-xs text-text-tertiary">Hard due date - must be done by this date</div>
                </div>
              </label>
            </div>
          </div>

          {/* Date Picker */}
          {(dateType === 'deadline' || dateType === 'target') && (
            <div className="mb-4">
              <label htmlFor="task-date" className="block text-sm font-medium text-text-secondary mb-2">
                {dateType === 'deadline' ? 'Deadline Date' : 'Target Date'} <span className="text-danger-500">*</span>
              </label>
              <input
                id="task-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 bg-dark-base border border-dark-border text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent [color-scheme:dark]"
              />
            </div>
          )}

          {/* Description (Optional) */}
          <div className="mb-4">
            <label htmlFor="task-description" className="block text-sm font-medium text-text-secondary mb-2">
              Description <span className="text-text-tertiary">(Optional)</span>
            </label>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any additional details or context..."
              rows={3}
              className="w-full px-3 py-2 bg-dark-base border border-dark-border text-text-primary placeholder-text-tertiary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-text-tertiary mt-1">
              You can add more notes later in the task details
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium flex items-center gap-2"
            >
              <span>Add Task</span>
              <span className="text-xs opacity-75">(Enter)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default QuickAddTaskModal;
