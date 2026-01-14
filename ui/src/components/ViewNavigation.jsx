import React from 'react';

function ViewNavigation({ currentView, onViewChange }) {
  const views = [
    { id: 'today', label: 'Today', icon: '📋' },
    { id: 'all-tasks', label: 'All Tasks', icon: '📊' },
    { id: 'ideas', label: 'Ideas', icon: '💡' },
    { id: 'archive', label: 'Archive', icon: '📦' }
  ];

  return (
    <nav className="bg-dark-surface border-b border-dark-border px-6">
      <div className="flex gap-1">
        {views.map((view) => (
          <button
            key={view.id}
            onClick={() => onViewChange(view.id)}
            className={`
              px-6 py-3 font-medium text-sm transition-all relative
              ${currentView === view.id
                ? 'text-primary-400 bg-dark-elevated'
                : 'text-text-secondary hover:text-text-primary hover:bg-dark-hover'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{view.icon}</span>
              <span>{view.label}</span>
            </div>

            {/* Active indicator bar */}
            {currentView === view.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}

export default ViewNavigation;
