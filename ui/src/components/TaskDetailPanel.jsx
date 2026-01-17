import React, { useState, useEffect } from 'react';
import EditableField from './EditableField';
import DatePicker from './DatePicker';
import NotesEditor from './NotesEditor';
import AttachmentList from './AttachmentList';
import FileUpload from './FileUpload';
import { getTaskUrgency, getUrgencyColor, getUrgencyTextColor, getUrgencyLabel } from '../utils/dateUtils';

function TaskDetailPanel({ task, column, onClose, onSave, onDelete, onMarkDone, onMove, onMarkDropped, onMoveToBacklog, onStartPomodoro }) {
  const [editedTask, setEditedTask] = useState(task);

  useEffect(() => {
    setEditedTask(task);
  }, [task]);

  const handleFieldChange = (field, value) => {
    const updatedTask = { ...editedTask, [field]: value };
    setEditedTask(updatedTask);
    onSave(updatedTask);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const urgency = getTaskUrgency(editedTask);
  const urgencyColor = getUrgencyTextColor(urgency);
  const urgencyLabel = getUrgencyLabel(urgency);

  const hasDeadline = editedTask.deadline !== 'none';
  const hasTargetDate = editedTask.target_date !== 'none';

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex justify-end">
      <div
        className="absolute inset-0"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex-1">
            <input
              type="text"
              value={editedTask.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              className="text-xl font-bold text-neutral-800 w-full border-none outline-none focus:ring-2 focus:ring-primary-500 rounded px-2 py-1"
            />
            {(hasDeadline || hasTargetDate) && (
              <div className={`mt-2 text-sm font-medium ${urgencyColor}`}>
                {urgencyLabel && <span className="uppercase tracking-wide">{urgencyLabel}</span>}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-neutral-400 hover:text-neutral-600 p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Metadata Section */}
          <div className="bg-neutral-50 rounded-lg p-4 space-y-1">
            <h3 className="text-sm font-bold text-neutral-700 mb-3">Details</h3>

            <DatePicker
              label="Deadline"
              value={editedTask.deadline}
              onChange={(value) => handleFieldChange('deadline', value)}
            />

            <DatePicker
              label="Target Date"
              value={editedTask.target_date}
              onChange={(value) => handleFieldChange('target_date', value)}
            />

            <EditableField
              label="Priority"
              value={editedTask.priority}
              type="select"
              options={['none', 'low', 'medium', 'high']}
              onChange={(value) => handleFieldChange('priority', value)}
            />

            <EditableField
              label="Status"
              value={editedTask.status}
              type="select"
              options={['open', 'in-progress', 'completed']}
              onChange={(value) => handleFieldChange('status', value)}
            />

            {editedTask.days_in_today > 0 && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium text-neutral-600 w-32">Days in Today</span>
                <span className="text-neutral-800">{editedTask.days_in_today}</span>
              </div>
            )}

            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-neutral-600 w-32">Task ID</span>
              <span className="text-neutral-500 text-sm font-mono">{editedTask.id}</span>
            </div>
          </div>

          {/* Notes Section */}
          <div className="bg-neutral-50 rounded-lg p-4">
            <NotesEditor
              notes={editedTask.notes}
              onChange={(notes) => handleFieldChange('notes', notes)}
            />
          </div>

          {/* Attachments Section */}
          <div className="bg-neutral-50 rounded-lg p-4">
            <h3 className="text-sm font-bold text-neutral-700 mb-3">Attachments</h3>

            {/* Attachment List */}
            <div className="mb-4">
              <AttachmentList
                taskId={editedTask.id}
                onAttachmentsChange={() => {
                  // Trigger a re-render or refresh if needed
                }}
              />
            </div>

            {/* File Upload */}
            <FileUpload
              taskId={editedTask.id}
              onUploadComplete={() => {
                // Trigger a re-render or refresh
                window.location.reload();
              }}
            />
          </div>

          {/* Subtasks Info */}
          {editedTask.subtasks !== 'none' && (
            <div className="bg-primary-50 rounded-lg p-4">
              <h3 className="text-sm font-bold text-primary-700 mb-2">Subtasks</h3>
              <p className="text-sm text-primary-600">
                IDs: {editedTask.subtasks}
              </p>
            </div>
          )}

          {/* Parent Task Info */}
          {editedTask.parent_id !== 'none' && (
            <div className="bg-primary-50 rounded-lg p-4">
              <h3 className="text-sm font-bold text-primary-700 mb-2">Parent Task</h3>
              <p className="text-sm text-primary-600">
                ID: {editedTask.parent_id}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-6 py-4">
          <div className="grid grid-cols-4 gap-3">
            <button
              onClick={() => {
                if (confirm(`Mark "${task.title}" as done?`)) {
                  onMarkDone(task, column);
                }
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-success-600 text-white rounded-lg hover:bg-success-700 font-medium transition-colors"
            >
              <span className="text-lg">✓</span>
              <span>Done</span>
            </button>

            <button
              onClick={() => {
                if (confirm(`Cancel "${task.title}" and mark as dropped?`)) {
                  onMarkDropped(task, column);
                }
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 font-medium transition-colors"
            >
              <span className="text-lg">✕</span>
              <span>Cancel</span>
            </button>

            <button
              onClick={() => {
                const confirmMsg = column === 'today'
                  ? `Move "${task.title}" back to original list?`
                  : `Move "${task.title}" to Today?`;
                if (confirm(confirmMsg)) {
                  onMoveToBacklog(task, column);
                }
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium transition-colors"
            >
              <span className="text-lg">{column === 'today' ? '←' : '→'}</span>
              <span>{column === 'today' ? 'Back' : 'Today'}</span>
            </button>

            <button
              onClick={() => onStartPomodoro(task)}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-neutral-800 text-white rounded-lg hover:bg-neutral-900 font-medium transition-colors"
            >
              <span className="text-lg">🍅</span>
              <span>Focus</span>
            </button>
          </div>

          <div className="mt-3 text-xs text-neutral-500">
            Changes are saved automatically • Press <kbd className="px-1.5 py-0.5 bg-neutral-100 rounded">Esc</kbd> to close
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaskDetailPanel;
