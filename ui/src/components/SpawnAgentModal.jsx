import React, { useState, useEffect } from 'react';

function SpawnAgentModal({ tasks, onSpawn, onClose, preselectedTaskId }) {
  const [taskDescription, setTaskDescription] = useState('');
  const [linkedTaskId, setLinkedTaskId] = useState('');

  // Get all tasks from today for linking
  const allTasks = tasks?.today || [];

  // Pre-fill when preselectedTaskId is provided
  useEffect(() => {
    if (preselectedTaskId) {
      setLinkedTaskId(preselectedTaskId);
      const task = allTasks.find(t => t.id === preselectedTaskId);
      if (task) {
        setTaskDescription(`Work on: ${task.title}`);
      }
    }
  }, [preselectedTaskId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (taskDescription.trim()) {
      onSpawn(taskDescription, linkedTaskId || null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="glass border border-dark-border rounded-lg w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-border">
          <h2 className="text-xl font-bold text-text-primary">Spawn New Agent</h2>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Task Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-text-primary mb-2">
              What should this agent work on? <span className="text-red-400">*</span>
            </label>
            <textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="E.g., 'Draft an email to the team about Q1 goals' or 'Research competitor pricing for our product'"
              className="w-full px-3 py-2 bg-dark-hover border border-dark-border rounded text-text-primary resize-none focus:outline-none focus:border-primary-500"
              rows={4}
              autoFocus
              required
            />
            <p className="text-xs text-text-tertiary mt-1">
              Be specific about what you want the agent to do. The agent will save its output to an artifact file.
            </p>
          </div>

          {/* Linked Task (Optional) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-text-primary mb-2">
              Link to Task <span className="text-text-tertiary">(optional)</span>
            </label>
            <select
              value={linkedTaskId}
              onChange={(e) => setLinkedTaskId(e.target.value)}
              className="w-full px-3 py-2 bg-dark-hover border border-dark-border rounded text-text-primary focus:outline-none focus:border-primary-500"
            >
              <option value="">No linked task</option>
              {allTasks.map(task => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-tertiary mt-1">
              If linked, the agent's artifact will be automatically attached to the task when approved.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-dark-hover hover:bg-dark-active text-text-secondary rounded font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!taskDescription.trim()}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span>🤖</span>
              <span>Spawn Agent</span>
            </button>
          </div>
        </form>

        {/* Helper Examples */}
        <div className="px-6 pb-6">
          <div className="bg-dark-hover rounded-lg p-4">
            <p className="text-xs font-semibold text-text-primary mb-2">💡 Example Tasks:</p>
            <ul className="text-xs text-text-secondary space-y-1">
              <li>• "Draft an email to thank the client for the meeting"</li>
              <li>• "Research the latest trends in AI coding assistants"</li>
              <li>• "Create a meeting agenda for tomorrow's standup"</li>
              <li>• "Summarize the key points from this article: [URL]"</li>
              <li>• "Write a product description for our new feature"</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SpawnAgentModal;
