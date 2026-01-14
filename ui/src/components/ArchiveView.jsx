import React, { useState, useMemo } from 'react';
import Card from './ui/Card';
import Badge from './ui/Badge';
import { formatDeadline } from '../utils/dateUtils';

function ArchiveView({ archivedTasks, onRestore, onDelete }) {
  const [activeTab, setActiveTab] = useState('done'); // 'done' or 'dropped'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' or 'oldest'

  // Get current tab's tasks
  const currentTasks = activeTab === 'done' ? archivedTasks.done : archivedTasks.dropped;

  // Filter and sort tasks
  const filteredAndSortedTasks = useMemo(() => {
    let filtered = currentTasks;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(query) ||
        (task.notes && task.notes.some(note => note.toLowerCase().includes(query)))
      );
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      const dateA = a.completed_date || '0000-00-00';
      const dateB = b.completed_date || '0000-00-00';
      return sortOrder === 'newest'
        ? dateB.localeCompare(dateA)
        : dateA.localeCompare(dateB);
    });

    return sorted;
  }, [currentTasks, searchQuery, sortOrder]);

  // Stats
  const totalDone = archivedTasks.done.length;
  const totalDropped = archivedTasks.dropped.length;

  // Calculate this week/month stats
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const completedThisWeek = archivedTasks.done.filter(task => {
    if (!task.completed_date) return false;
    const completedDate = new Date(task.completed_date);
    return completedDate >= weekAgo;
  }).length;

  const completedThisMonth = archivedTasks.done.filter(task => {
    if (!task.completed_date) return false;
    const completedDate = new Date(task.completed_date);
    return completedDate >= monthAgo;
  }).length;

  const handleDelete = (task) => {
    if (confirm(`Permanently delete "${task.title}"? This cannot be undone.`)) {
      onDelete(task, activeTab);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-dark-base p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-text-primary flex items-center gap-2">
            <span>📦</span>
            Archive
          </h2>
          {activeTab === 'done' && (
            <div className="mt-2 flex gap-4 text-sm text-text-secondary">
              <span>🎉 {totalDone} completed</span>
              <span>•</span>
              <span>📅 {completedThisWeek} this week</span>
              <span>•</span>
              <span>📆 {completedThisMonth} this month</span>
            </div>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab('done')}
            className={`px-6 py-2 rounded-lg font-medium transition-all border ${
              activeTab === 'done'
                ? 'bg-success-500/20 text-success-400 border-success-500/50 shadow-glass-sm'
                : 'bg-dark-elevated text-text-secondary border-dark-border hover:bg-dark-hover hover:border-success-500/30 hover:text-text-primary'
            }`}
          >
            ✓ Completed ({totalDone})
          </button>
          <button
            onClick={() => setActiveTab('dropped')}
            className={`px-6 py-2 rounded-lg font-medium transition-all border ${
              activeTab === 'dropped'
                ? 'bg-text-tertiary/20 text-text-primary border-text-tertiary/50 shadow-glass-sm'
                : 'bg-dark-elevated text-text-secondary border-dark-border hover:bg-dark-hover hover:border-text-tertiary/30 hover:text-text-primary'
            }`}
          >
            ✗ Dropped ({totalDropped})
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full px-4 py-2 bg-dark-elevated border border-dark-border text-text-primary placeholder-text-tertiary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all"
            />
          </div>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-4 py-2 bg-dark-elevated border border-dark-border text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        {/* Tasks List */}
        {filteredAndSortedTasks.length === 0 ? (
          <div className="text-center py-20">
            {searchQuery ? (
              <>
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-text-primary mb-2">No results found</h3>
                <p className="text-text-tertiary">Try a different search query</p>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">📦</div>
                <h3 className="text-xl font-semibold text-text-primary mb-2">
                  No {activeTab === 'done' ? 'completed' : 'dropped'} tasks yet
                </h3>
                <p className="text-text-tertiary">
                  {activeTab === 'done'
                    ? 'Tasks you complete will appear here'
                    : 'Abandoned tasks will appear here'}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAndSortedTasks.map((task, index) => (
              <Card
                key={`${task.id}-${index}`}
                variant="default"
                className="p-4 hover:border-primary-500/30 transition-all"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">
                        {activeTab === 'done' ? '✓' : '✗'}
                      </span>
                      <h3 className="font-semibold text-text-primary">{task.title}</h3>
                    </div>

                    {/* Metadata */}
                    <div className="ml-7 space-y-1 text-sm text-text-secondary">
                      {task.completed_date && (
                        <div className="flex items-center gap-2">
                          <span className={activeTab === 'done' ? 'text-success-400' : 'text-text-tertiary'}>
                            {activeTab === 'done' ? '✓ Completed:' : '✗ Dropped:'}
                          </span>
                          <span>{formatDeadline(task.completed_date)}</span>
                        </div>
                      )}
                      {task.deadline !== 'none' && (
                        <div>⏰ Deadline was: {formatDeadline(task.deadline)}</div>
                      )}
                      {task.target_date !== 'none' && task.deadline === 'none' && (
                        <div>🎯 Target was: {formatDeadline(task.target_date)}</div>
                      )}
                      {task.priority !== 'none' && (
                        <div className="capitalize">Priority: {task.priority}</div>
                      )}
                      {task.days_in_today > 0 && (
                        <div>Was in today for {task.days_in_today} day{task.days_in_today !== 1 ? 's' : ''}</div>
                      )}
                    </div>

                    {/* Notes Preview */}
                    {task.notes && task.notes.length > 0 && task.notes[0] !== '' && (
                      <div className="ml-7 mt-2 text-sm text-text-tertiary">
                        <div className="flex items-start gap-2">
                          <span>📝</span>
                          <span className="line-clamp-2">{task.notes[0]}</span>
                        </div>
                        {task.notes.length > 1 && (
                          <span className="text-xs">+{task.notes.length - 1} more note{task.notes.length - 1 !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="ml-7 flex gap-2">
                  <button
                    onClick={() => onRestore(task, activeTab)}
                    className="flex-1 py-2 px-3 text-sm font-medium text-success-400 bg-success-500/10 hover:bg-success-500/20 border border-success-500/30 hover:border-success-400/50 rounded-md transition-all"
                  >
                    ♻️ Restore
                  </button>
                  <button
                    onClick={() => handleDelete(task)}
                    className="flex-1 py-2 px-3 text-sm font-medium text-danger-400 bg-danger-500/10 hover:bg-danger-500/20 border border-danger-500/30 hover:border-danger-400/50 rounded-md transition-all"
                  >
                    🗑️ Delete Forever
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Results count */}
        {filteredAndSortedTasks.length > 0 && (
          <div className="mt-4 text-center text-sm text-text-tertiary">
            Showing {filteredAndSortedTasks.length} of {currentTasks.length} tasks
          </div>
        )}
      </div>
    </div>
  );
}

export default ArchiveView;
