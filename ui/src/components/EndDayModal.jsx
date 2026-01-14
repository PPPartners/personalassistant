import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { categorizeUnfinishedTasks, getCompletedTasksToday } from '../utils/endDayUtils';
import { formatDeadline, getTaskUrgency, getUrgencyColor } from '../utils/dateUtils';

function EndDayModal({ isOpen, onClose, todayTasks, onEndDay }) {
  const [completedTasks, setCompletedTasks] = useState([]);
  const [autoKeepTasks, setAutoKeepTasks] = useState([]);
  const [decisionTasks, setDecisionTasks] = useState([]);
  const [decisions, setDecisions] = useState({}); // { taskId: 'keep' | 'backlog' }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadEndDayData();
    }
  }, [isOpen, todayTasks]);

  const loadEndDayData = async () => {
    setLoading(true);

    // Get completed tasks
    const completed = await getCompletedTasksToday();
    setCompletedTasks(completed);

    // Categorize unfinished tasks
    const { autoKeep, needDecision } = categorizeUnfinishedTasks(todayTasks);
    setAutoKeepTasks(autoKeep);
    setDecisionTasks(needDecision);

    // Initialize all decisions to 'keep' by default
    const initialDecisions = {};
    needDecision.forEach(task => {
      initialDecisions[task.id] = 'keep';
    });
    setDecisions(initialDecisions);

    setLoading(false);
  };

  const toggleDecision = (taskId) => {
    setDecisions(prev => ({
      ...prev,
      [taskId]: prev[taskId] === 'keep' ? 'backlog' : 'keep'
    }));
  };

  const handleFinish = () => {
    // Collect all task IDs by decision
    const keep = [];
    const moveToBacklog = [];

    // Auto-keep tasks always stay
    autoKeepTasks.forEach(task => keep.push(task.id));

    // Add user decisions
    Object.entries(decisions).forEach(([taskId, decision]) => {
      if (decision === 'keep') {
        keep.push(taskId);
      } else {
        moveToBacklog.push(taskId);
      }
    });

    onEndDay({ keep, moveToBacklog });
    onClose();
  };

  if (!isOpen) return null;

  const keepCount = autoKeepTasks.length + Object.values(decisions).filter(d => d === 'keep').length;
  const backlogCount = Object.values(decisions).filter(d => d === 'backlog').length;

  // Task Card Component
  const TaskCard = ({ task, showDecision = false, decision = null, onToggle = null }) => {
    const urgency = getTaskUrgency(task);
    const urgencyColor = getUrgencyColor(urgency);

    return (
      <div className={`bg-dark-base rounded border-l-4 ${urgencyColor} p-3 mb-2`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h4 className="font-medium text-sm text-text-primary mb-1">{task.title}</h4>
            <div className="flex items-center gap-3 text-xs text-text-tertiary">
              {task.deadline !== 'none' && (
                <span>⏰ {formatDeadline(task.deadline)}</span>
              )}
              {task.target_date !== 'none' && task.deadline === 'none' && (
                <span>🎯 {formatDeadline(task.target_date)}</span>
              )}
              {task.days_in_today > 0 && (
                <span className="text-warning-600 font-medium">📌 Day {task.days_in_today}</span>
              )}
            </div>
          </div>

          {showDecision && onToggle && (
            <div className="flex gap-2">
              <button
                onClick={() => onToggle(task.id)}
                className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                  decision === 'keep'
                    ? 'bg-success-500 text-white'
                    : 'bg-dark-hover text-text-secondary hover:bg-dark-border'
                }`}
              >
                Keep
              </button>
              <button
                onClick={() => onToggle(task.id)}
                className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                  decision === 'backlog'
                    ? 'bg-neutral-600 text-white'
                    : 'bg-dark-hover text-text-secondary hover:bg-dark-border'
                }`}
              >
                Backlog
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-elevated rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-border bg-gradient-to-r from-indigo-500 to-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="text-3xl">🌙</span>
                End Your Day
              </h2>
              <p className="text-sm text-indigo-100">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-indigo-100 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-8 text-text-tertiary">Loading...</div>
          ) : (
            <div className="space-y-6">
              {/* Section 1: Completed Today */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">✅</span>
                  <h3 className="text-lg font-semibold text-text-primary">Completed Today</h3>
                  <span className="text-sm bg-success-100 text-success-700 px-2 py-1 rounded-full font-medium">
                    {completedTasks.length}
                  </span>
                </div>
                {completedTasks.length === 0 ? (
                  <p className="text-sm text-text-tertiary bg-dark-hover rounded p-3">
                    No tasks completed today yet. Tomorrow is another chance!
                  </p>
                ) : (
                  <div className="bg-success-50 rounded-lg p-4 border border-success-200">
                    <div className="space-y-2">
                      {completedTasks.map(task => (
                        <div key={task.id} className="bg-dark-base rounded p-2 text-sm">
                          <span className="text-success-600 mr-2">✓</span>
                          <span className="text-text-primary">{task.title}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-success-700 mt-3 font-medium">
                      Great work today! 🎉
                    </p>
                  </div>
                )}
              </div>

              {/* Section 2: Auto-Kept Tasks */}
              {autoKeepTasks.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">🔒</span>
                    <h3 className="text-lg font-semibold text-text-primary">Staying for Tomorrow</h3>
                    <span className="text-sm bg-warning-100 text-warning-700 px-2 py-1 rounded-full font-medium">
                      {autoKeepTasks.length}
                    </span>
                  </div>
                  <div className="bg-warning-50 rounded-lg p-4 border border-warning-200 mb-3">
                    <p className="text-sm text-warning-800 mb-3">
                      These tasks have deadlines ≤3 days away and will automatically stay in today.
                    </p>
                    <div>
                      {autoKeepTasks.map(task => (
                        <TaskCard key={task.id} task={task} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Section 3: Decision Needed */}
              {decisionTasks.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">🤔</span>
                    <h3 className="text-lg font-semibold text-text-primary">What About These?</h3>
                    <span className="text-sm bg-primary-100 text-primary-700 px-2 py-1 rounded-full font-medium">
                      {decisionTasks.length}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary mb-3">
                    Choose which tasks to keep for tomorrow or move back to backlog:
                  </p>
                  <div>
                    {decisionTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        showDecision={true}
                        decision={decisions[task.id]}
                        onToggle={toggleDecision}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* No unfinished tasks */}
              {autoKeepTasks.length === 0 && decisionTasks.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">🎉</div>
                  <h3 className="text-xl font-semibold text-text-primary mb-2">
                    All Clear!
                  </h3>
                  <p className="text-text-secondary">
                    You've completed everything for today. Enjoy your evening!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-dark-border bg-dark-hover">
          <div className="flex items-center justify-between">
            <div className="text-sm text-text-secondary">
              <span className="font-medium text-success-600">{keepCount} staying</span>
              {backlogCount > 0 && (
                <>
                  <span className="mx-2">•</span>
                  <span className="font-medium text-text-secondary">{backlogCount} to backlog</span>
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleFinish}
                className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all font-medium shadow-md"
              >
                Finish Day
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EndDayModal;
