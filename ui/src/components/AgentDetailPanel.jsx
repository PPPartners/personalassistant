import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

function AgentDetailPanel({ agent, onClose, onTerminate }) {
  const [artifact, setArtifact] = useState(null);
  const [artifactFilename, setArtifactFilename] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [proactiveFeedback, setProactiveFeedback] = useState('');
  const [activeTab, setActiveTab] = useState('activity'); // activity, files, output
  const [activityLog, setActivityLog] = useState([]);
  const [workspaceFiles, setWorkspaceFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFileContent, setSelectedFileContent] = useState(null);

  useEffect(() => {
    console.log('[AgentDetailPanel] Agent state changed:', {
      id: agent.id,
      state: agent.state,
      hasPendingTool: !!agent.pendingToolUse
    });

    // Load agent artifact if available
    loadArtifact();
    loadActivity();
    loadWorkspaceFiles();

    // Poll for updates every 500ms while agent is working
    const interval = setInterval(() => {
      if (agent.state === 'working' || agent.state === 'completed' || agent.state === 'waiting_for_completion_review') {
        loadArtifact();
        loadActivity();
        loadWorkspaceFiles();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [agent.id, agent.state, agent.pendingToolUse]);

  const loadArtifact = async () => {
    const result = await window.electronAPI.getAgentArtifact(agent.id);
    if (result.success) {
      setArtifact(result.content);
      setArtifactFilename(result.filename);
    }
  };

  const loadActivity = async () => {
    const result = await window.electronAPI.getAgentActivity(agent.id);
    if (result.success) {
      setActivityLog(result.activityLog || []);
    }
  };

  const loadWorkspaceFiles = async () => {
    const result = await window.electronAPI.listWorkspaceFiles(agent.id);
    if (result.success) {
      setWorkspaceFiles(result.files || []);
    }
  };

  const loadFileContent = async (filename) => {
    const result = await window.electronAPI.readWorkspaceFile(agent.id, filename);
    if (result.success) {
      setSelectedFile(filename);
      setSelectedFileContent(result.content);
    }
  };

  const handleApproveTool = async () => {
    const result = await window.electronAPI.approveTool(agent.id);
    if (result.success) {
      // Close modal - user can reopen to check progress
      onClose();
    } else {
      alert(`Failed to approve tool: ${result.error}`);
    }
  };

  const handleRejectTool = async () => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    const result = await window.electronAPI.rejectTool(agent.id, rejectReason);
    if (result.success) {
      setRejectReason('');
      setShowRejectInput(false);
      // Close modal - user can reopen to check progress
      onClose();
    } else {
      alert(`Failed to reject tool: ${result.error}`);
    }
  };

  const handleProvideFeedback = async (feedbackText) => {
    if (!feedbackText.trim()) {
      alert('Please provide some feedback');
      return;
    }
    const result = await window.electronAPI.provideFeedback(agent.id, feedbackText);
    if (result.success) {
      setFeedbackText('');
      setProactiveFeedback('');
      // Close modal - user can reopen to check progress
      onClose();
    } else {
      alert(`Failed to send feedback: ${result.error}`);
    }
  };

  const handleCopyArtifact = () => {
    if (artifact) {
      navigator.clipboard.writeText(artifact);
      alert('Artifact copied to clipboard!');
    }
  };

  const getStatusBadge = () => {
    const badges = {
      initializing: (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
          Starting...
        </span>
      ),
      working: (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          Working
        </span>
      ),
      waiting_for_tool_approval: (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium">
          ⚠️ Needs Approval
        </span>
      ),
      waiting_for_user_feedback: (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm font-medium">
          ❓ Asking Question
        </span>
      ),
      waiting_for_completion_review: (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-medium">
          ⭐ Ready for Review
        </span>
      ),
      completed: (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
          ✅ Done
        </span>
      ),
      failed: (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium">
          ❌ Failed
        </span>
      )
    };
    return badges[agent.state] || null;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="glass border border-dark-border rounded-lg w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-dark-border">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-bold text-text-primary">
                {agent.name}
              </h2>
              {getStatusBadge()}
            </div>
            <p className="text-sm text-text-secondary">{agent.task}</p>
            {agent.linkedTaskId && (
              <div className="mt-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-500/20 text-primary-400 text-xs rounded">
                  <span>🔗</span>
                  <span>Linked to: {agent.linkedTaskId}</span>
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-text-tertiary hover:text-text-primary transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-dark-border px-6">
            <button
              onClick={() => setActiveTab('activity')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'activity'
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-text-tertiary hover:text-text-secondary'
              }`}
            >
              Activity
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'files'
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-text-tertiary hover:text-text-secondary'
              }`}
            >
              Files ({workspaceFiles.length})
            </button>
            <button
              onClick={() => setActiveTab('output')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'output'
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-text-tertiary hover:text-text-secondary'
              }`}
            >
              Output
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'activity' && (
              <div className="space-y-3">
                {activityLog.length === 0 ? (
                  <div className="text-center text-text-tertiary py-8">
                    <div className="text-4xl mb-2">⏳</div>
                    <p>No activity yet. Agent is initializing...</p>
                  </div>
                ) : (
                  [...activityLog].reverse().map((activity, index) => (
                    <div
                      key={activity.id || index}
                      className={`border rounded-lg p-4 ${
                        activity.status === 'success'
                          ? 'border-green-500/30 bg-green-500/5'
                          : activity.status === 'error'
                          ? 'border-red-500/30 bg-red-500/5'
                          : 'border-yellow-500/30 bg-yellow-500/5'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-mono px-2 py-1 rounded ${
                              activity.status === 'success'
                                ? 'bg-green-500/20 text-green-400'
                                : activity.status === 'error'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}
                          >
                            {activity.tool}
                          </span>
                          <span className="text-xs text-text-tertiary">
                            {activity.model || 'unknown'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-tertiary">
                            {new Date(activity.timestamp).toLocaleTimeString()}
                          </span>
                          {activity.duration && (
                            <span className="text-xs text-text-tertiary">
                              {activity.duration}ms
                            </span>
                          )}
                        </div>
                      </div>

                      {activity.status === 'error' && activity.error && (
                        <div className="text-sm text-red-400 mb-2">
                          Error: {activity.error}
                        </div>
                      )}

                      {activity.input && (
                        <details className="text-sm">
                          <summary className="cursor-pointer text-text-secondary hover:text-text-primary">
                            Input
                          </summary>
                          <pre className="mt-2 p-2 bg-dark-surface rounded text-xs overflow-x-auto">
                            {JSON.stringify(activity.input, null, 2)}
                          </pre>
                        </details>
                      )}

                      {activity.result && activity.status === 'success' && (
                        <details className="text-sm mt-2">
                          <summary className="cursor-pointer text-text-secondary hover:text-text-primary">
                            Result
                          </summary>
                          <pre className="mt-2 p-2 bg-dark-surface rounded text-xs overflow-x-auto">
                            {JSON.stringify(activity.result, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'files' && (
              <div>
                {workspaceFiles.length === 0 ? (
                  <div className="text-center text-text-tertiary py-8">
                    <div className="text-4xl mb-2">📁</div>
                    <p>No files created yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-dark-border rounded-lg">
                      <div className="p-3 border-b border-dark-border bg-dark-hover">
                        <h3 className="text-sm font-semibold text-text-primary">Files</h3>
                      </div>
                      <div className="divide-y divide-dark-border">
                        {workspaceFiles.map((file) => (
                          <button
                            key={file}
                            onClick={() => loadFileContent(file)}
                            className={`w-full text-left px-3 py-2 text-sm font-mono transition-colors ${
                              selectedFile === file
                                ? 'bg-primary-500/20 text-primary-400'
                                : 'text-text-secondary hover:bg-dark-hover'
                            }`}
                          >
                            {file}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="border border-dark-border rounded-lg">
                      <div className="p-3 border-b border-dark-border bg-dark-hover">
                        <h3 className="text-sm font-semibold text-text-primary">
                          {selectedFile || 'Preview'}
                        </h3>
                      </div>
                      <div className="p-4 overflow-auto max-h-[500px]">
                        {selectedFileContent ? (
                          selectedFile?.endsWith('.md') ? (
                            <div className="prose prose-invert prose-sm max-w-none">
                              <ReactMarkdown>{selectedFileContent}</ReactMarkdown>
                            </div>
                          ) : (
                            <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap">
                              {selectedFileContent}
                            </pre>
                          )
                        ) : (
                          <div className="text-center text-text-tertiary py-8">
                            Select a file to preview
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'output' && (
              <div>
                {artifact ? (
                  <div>
                    {artifactFilename && (
                      <div className="mb-4 pb-2 border-b border-dark-border">
                        <span className="text-sm text-text-tertiary">Viewing: </span>
                        <span className="text-sm font-mono text-primary-400">{artifactFilename}</span>
                      </div>
                    )}
                    <div className="prose prose-invert max-w-none">
                      <ReactMarkdown>{artifact}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-text-tertiary">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📝</div>
                      <p>No artifact yet. Agent is still working...</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tool Approval Section - when agent wants to use a tool */}
        {agent.state === 'waiting_for_tool_approval' && agent.pendingToolUse && (
          <div className="border-t border-dark-border p-6 bg-yellow-500/10">
            <div className="mb-4">
              <div className="text-lg font-semibold text-yellow-400 mb-2">
                ⚠️ Agent Requesting Tool Approval
              </div>
              <p className="text-text-secondary text-sm mb-3">
                The agent wants to use the following tool. Review and approve or reject.
              </p>
            </div>

            {/* Tool Details */}
            <div className="mb-4 border border-dark-border rounded-lg overflow-hidden bg-dark-bg">
              <div className="bg-dark-hover px-4 py-2 border-b border-dark-border">
                <span className="text-primary-400 font-semibold">Tool: {agent.pendingToolUse.name}</span>
              </div>
              <div className="p-4 max-h-96 overflow-y-auto">
                {agent.pendingToolUse.name === 'write_file' &&
                 agent.pendingToolUse.input.filename?.endsWith('.md') ? (
                  // Markdown preview for .md files
                  <div>
                    <div className="text-xs text-text-tertiary mb-2">
                      File: <span className="font-mono text-primary-400">{agent.pendingToolUse.input.filename}</span>
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none bg-dark-surface p-4 rounded">
                      <ReactMarkdown>{agent.pendingToolUse.input.content}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  // JSON preview for other tools
                  <pre className="text-sm font-mono text-text-secondary whitespace-pre-wrap">
                    {JSON.stringify(agent.pendingToolUse.input, null, 2)}
                  </pre>
                )}
              </div>
            </div>

            {/* Reject Input (conditional) */}
            {showRejectInput && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Reason for Rejection:
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Why are you rejecting this tool use?"
                  className="w-full px-3 py-2 bg-dark-hover border border-dark-border rounded text-text-primary text-sm resize-none focus:outline-none focus:border-primary-500"
                  rows={3}
                  autoFocus
                />
              </div>
            )}

            {/* Approve/Reject Buttons */}
            <div className="flex items-center gap-3">
              {!showRejectInput ? (
                <>
                  <button
                    onClick={handleApproveTool}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-medium transition-colors"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => setShowRejectInput(true)}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded font-medium transition-colors"
                  >
                    ✗ Reject
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleRejectTool}
                    disabled={!rejectReason.trim()}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit Rejection
                  </button>
                  <button
                    onClick={() => {
                      setShowRejectInput(false);
                      setRejectReason('');
                    }}
                    className="px-4 py-2 bg-dark-hover hover:bg-dark-active text-text-primary rounded font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Review Section - when agent claims completion */}
        {agent.state === 'waiting_for_completion_review' && (
          <div className="border-t border-dark-border p-6 bg-purple-500/10">
            <div className="text-lg font-semibold text-purple-400 mb-2">⭐ Task Complete - Review Required</div>
            <p className="text-text-secondary text-sm mb-3">
              {agent.completionSummary || 'The agent has marked this task as complete. Review the artifact above.'}
            </p>
          </div>
        )}

        {/* User Feedback Section - when agent asks a question */}
        {agent.state === 'waiting_for_user_feedback' && agent.pendingQuestion && (
          <div className="border-t border-dark-border p-6 bg-orange-500/10">
            <div className="text-lg font-semibold text-orange-400 mb-2">❓ Agent Has a Question</div>
            <div className="mb-4">
              <p className="text-text-primary font-medium mb-2">{agent.pendingQuestion.question}</p>
              {agent.pendingQuestion.context && (
                <p className="text-text-secondary text-sm italic">Context: {agent.pendingQuestion.context}</p>
              )}
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-text-primary mb-2">Your Answer:</label>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Type your answer here..."
                className="w-full px-3 py-2 bg-dark-hover border border-dark-border rounded text-text-primary text-sm resize-none focus:outline-none focus:border-orange-500"
                rows={3}
                autoFocus
              />
            </div>
            <button
              onClick={() => handleProvideFeedback(feedbackText)}
              disabled={!feedbackText.trim()}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Answer
            </button>
          </div>
        )}

        {/* Proactive Feedback Section - always available when working */}
        {(agent.state === 'working' || agent.state === 'initializing') && (
          <div className="border-t border-dark-border p-6 bg-dark-surface">
            <div className="text-sm font-semibold text-text-primary mb-2">💬 Give Feedback (Optional)</div>
            <p className="text-text-tertiary text-xs mb-3">Provide guidance or corrections to the agent while it's working</p>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <textarea
                  value={proactiveFeedback}
                  onChange={(e) => setProactiveFeedback(e.target.value)}
                  placeholder="Type feedback or guidance for the agent..."
                  className="w-full px-3 py-2 bg-dark-hover border border-dark-border rounded text-text-primary text-sm resize-none focus:outline-none focus:border-primary-500"
                  rows={2}
                />
              </div>
              <button
                onClick={() => handleProvideFeedback(proactiveFeedback)}
                disabled={!proactiveFeedback.trim()}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send Feedback
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between p-6 border-t border-dark-border">
          <button
            onClick={onTerminate}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded font-medium transition-colors"
          >
            Terminate Agent
          </button>

          <div className="flex items-center gap-3">
            {(agent.state === 'completed' || agent.state === 'waiting_for_completion_review') && artifact && (
              <button
                onClick={handleCopyArtifact}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-medium transition-colors"
              >
                Copy Artifact to Clipboard
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-dark-hover hover:bg-dark-active text-text-primary rounded font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgentDetailPanel;
