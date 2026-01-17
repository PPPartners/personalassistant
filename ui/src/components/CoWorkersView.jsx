import React, { useState, useEffect } from 'react';
import AgentCard from './AgentCard';
import AgentDetailPanel from './AgentDetailPanel';
import SpawnAgentModal from './SpawnAgentModal';

function CoWorkersView({ tasks, preselectedTaskId, onClearPreselection }) {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showSpawnModal, setShowSpawnModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load agents on mount
  useEffect(() => {
    loadAgents();
  }, []);

  // Auto-open spawn modal when task is preselected
  useEffect(() => {
    if (preselectedTaskId) {
      setShowSpawnModal(true);
    }
  }, [preselectedTaskId]);

  // Listen for agent status changes and tool approval requests
  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onAgentStatusChanged((data) => {
      console.log('Agent status changed:', data);
      loadAgents(); // Reload all agents when status changes
    });

    window.electronAPI.onAgentNeedsToolApproval((data) => {
      console.log('Agent needs tool approval:', data);
      loadAgents(); // Reload to show the agent's new state
    });
  }, []);

  const loadAgents = async () => {
    try {
      const agentList = await window.electronAPI.getAgents();
      console.log('[CoWorkersView] Loaded agents:', agentList.map(a => ({ id: a.id, state: a.state })));
      setAgents(agentList);

      // Update selectedAgent if it's currently set (to sync state)
      if (selectedAgent) {
        const updatedSelectedAgent = agentList.find(a => a.id === selectedAgent.id);
        if (updatedSelectedAgent) {
          setSelectedAgent(updatedSelectedAgent);
          console.log('[CoWorkersView] Updated selectedAgent with fresh data:', {
            id: updatedSelectedAgent.id,
            state: updatedSelectedAgent.state,
            hasPendingTool: !!updatedSelectedAgent.pendingToolUse
          });
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to load agents:', error);
      setLoading(false);
    }
  };

  const handleSpawnAgent = async (task, linkedTaskId) => {
    const result = await window.electronAPI.spawnAgent(task, linkedTaskId);
    if (result.success) {
      loadAgents();
      setShowSpawnModal(false);
    } else {
      alert('Failed to spawn agent: ' + result.error);
    }
  };

  const handleTerminateAgent = async (agentId) => {
    const result = await window.electronAPI.terminateAgent(agentId);
    if (result.success) {
      loadAgents();
      if (selectedAgent?.id === agentId) {
        setSelectedAgent(null);
      }
    }
  };

  const handleViewAgent = (agent) => {
    setSelectedAgent(agent);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-secondary">Loading agents...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-dark-border">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Co-Workers</h2>
          <p className="text-sm text-text-tertiary mt-1">
            {agents.length === 0
              ? 'No agents working yet'
              : `${agents.length} agent${agents.length === 1 ? '' : 's'} active`}
          </p>
        </div>
        <button
          onClick={() => setShowSpawnModal(true)}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <span className="text-lg">🤖</span>
          <span>New Agent</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {agents.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-4">🤖</div>
            <h3 className="text-xl font-semibold text-text-primary mb-2">
              No agents working yet
            </h3>
            <p className="text-text-secondary mb-6 max-w-md">
              Spawn an agent to help with tasks like drafting emails,
              researching topics, or creating summaries. Agents work
              independently and report back when done.
            </p>
            <button
              onClick={() => setShowSpawnModal(true)}
              className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
            >
              Spawn Your First Agent
            </button>
          </div>
        ) : (
          // Grid of agent cards
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onView={() => handleViewAgent(agent)}
                onTerminate={() => handleTerminateAgent(agent.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Agent Detail Panel */}
      {selectedAgent && (
        <AgentDetailPanel
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onTerminate={() => {
            handleTerminateAgent(selectedAgent.id);
          }}
        />
      )}

      {/* Spawn Agent Modal */}
      {showSpawnModal && (
        <SpawnAgentModal
          tasks={tasks}
          onSpawn={handleSpawnAgent}
          onClose={() => {
            setShowSpawnModal(false);
            if (onClearPreselection) onClearPreselection();
          }}
          preselectedTaskId={preselectedTaskId}
        />
      )}
    </div>
  );
}

export default CoWorkersView;
