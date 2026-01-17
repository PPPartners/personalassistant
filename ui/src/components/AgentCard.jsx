import React from 'react';

function AgentCard({ agent, onView, onTerminate }) {
  // Status indicator based on state machine
  const getStatusIcon = () => {
    switch (agent.state) {
      case 'initializing':
        return <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>;
      case 'working':
        return <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>;
      case 'waiting_for_tool_approval':
        return <div className="text-lg">⚠️</div>;
      case 'waiting_for_user_feedback':
        return <div className="text-lg">❓</div>;
      case 'waiting_for_completion_review':
        return <div className="text-lg">⭐</div>;
      case 'completed':
        return <div className="text-lg">✅</div>;
      case 'failed':
        return <div className="text-lg">❌</div>;
      default:
        return <div className="w-3 h-3 rounded-full bg-gray-500"></div>;
    }
  };

  const getStatusText = () => {
    switch (agent.state) {
      case 'initializing':
        return 'Starting...';
      case 'working':
        return 'Working';
      case 'waiting_for_tool_approval':
        return 'Needs Approval';
      case 'waiting_for_user_feedback':
        return 'Asking Question';
      case 'waiting_for_completion_review':
        return 'Ready for Review';
      case 'completed':
        return 'Done';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = () => {
    switch (agent.state) {
      case 'initializing':
        return 'text-blue-400';
      case 'working':
        return 'text-green-400';
      case 'waiting_for_tool_approval':
        return 'text-yellow-400';
      case 'waiting_for_user_feedback':
        return 'text-orange-400';
      case 'waiting_for_completion_review':
        return 'text-purple-400';
      case 'completed':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  // Get preview text
  const getPreviewText = () => {
    if (agent.artifact?.content) {
      return agent.artifact.content.substring(0, 100) + '...';
    }
    return agent.task;
  };

  return (
    <div className="glass border border-dark-border rounded-lg p-4 hover:border-primary-500 transition-colors cursor-pointer">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {getStatusIcon()}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-text-primary truncate">
              {agent.name}
            </h3>
            <p className={`text-xs font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </p>
          </div>
        </div>
      </div>

      {/* Preview */}
      <p className="text-sm text-text-secondary mb-4 line-clamp-3">
        {getPreviewText()}
      </p>

      {/* Linked task badge */}
      {agent.linkedTaskId && (
        <div className="mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-500/20 text-primary-400 text-xs rounded">
            <span>🔗</span>
            <span>Linked to task</span>
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {agent.state === 'waiting_for_tool_approval' ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            className="flex-1 px-3 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded font-medium text-sm transition-colors flex items-center justify-center gap-1"
          >
            <span>⚠️</span>
            <span>Approve Tool</span>
          </button>
        ) : agent.state === 'waiting_for_user_feedback' ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            className="flex-1 px-3 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded font-medium text-sm transition-colors flex items-center justify-center gap-1"
          >
            <span>❓</span>
            <span>Answer Question</span>
          </button>
        ) : agent.state === 'waiting_for_completion_review' ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            className="flex-1 px-3 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded font-medium text-sm transition-colors flex items-center justify-center gap-1"
          >
            <span>⭐</span>
            <span>Review Result</span>
          </button>
        ) : agent.state === 'completed' ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            className="flex-1 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded font-medium text-sm transition-colors"
          >
            View Result
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            className="flex-1 px-3 py-2 bg-dark-hover hover:bg-dark-active text-text-secondary rounded font-medium text-sm transition-colors"
          >
            View Output
          </button>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Terminate agent "${agent.name}"?`)) {
              onTerminate();
            }
          }}
          className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded font-medium text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default AgentCard;
