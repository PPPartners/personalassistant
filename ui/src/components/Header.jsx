import React from 'react';
import Button from './ui/Button';

function Header({ currentFocus, onStartDay, onEndDay, onShowFocus, onStartPomodoro }) {
  return (
    <header className="glass border-b border-dark-border px-6 py-4 flex items-end justify-between" style={{ WebkitAppRegion: 'drag' }}>
      <div className="select-none">
        <h1 className="text-2xl font-bold text-text-primary">PersonalAssistant</h1>
      </div>

      <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' }}>
        {currentFocus && (
          <Button variant="primary" onClick={onShowFocus}>
            <span className="text-lg">🎯</span>
            <span>Focus</span>
          </Button>
        )}

        <Button variant="secondary" onClick={onStartPomodoro} title="Start Focus">
          <span className="text-lg">🍅</span>
          <span>Focus</span>
        </Button>

        <Button variant="success" onClick={onStartDay}>
          <span className="text-lg">📅</span>
          <span>Start Day</span>
        </Button>

        <Button variant="ghost" onClick={onEndDay}>
          <span className="text-lg">🌙</span>
          <span>End Day</span>
        </Button>
      </div>
    </header>
  );
}

export default Header;
