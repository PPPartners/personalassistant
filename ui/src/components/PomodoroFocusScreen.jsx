import React, { useState, useEffect } from 'react';
import { formatDeadline } from '../utils/dateUtils';

function PomodoroFocusScreen({ pomodoro, onPause, onResume, onEnd }) {
  const [timeLeft, setTimeLeft] = useState(pomodoro.remainingTime);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          clearInterval(interval);
          // Timer completed
          setTimeout(() => {
            alert('🎉 Pomodoro completed! Great work!');
            onEnd();
          }, 100);
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, onEnd]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePause = () => {
    setIsPaused(true);
    onPause(timeLeft);
  };

  const handleResume = () => {
    setIsPaused(false);
    onResume();
  };

  const handleEnd = () => {
    if (confirm('Are you sure you want to end this Pomodoro session?')) {
      onEnd();
    }
  };

  const progress = ((pomodoro.duration - timeLeft) / pomodoro.duration) * 100;
  const task = pomodoro.task;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: 9999,
        background: 'linear-gradient(to bottom right, #ef4444, #dc2626)',
        backgroundColor: '#dc2626'
      }}
    >
      <div className="max-w-4xl w-full px-8">
        {/* Timer Display */}
        <div className="text-center mb-12">
          <div className="text-9xl font-bold text-white mb-4 tracking-tight">
            {formatTime(timeLeft)}
          </div>
          <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Task Info */}
        <div className="bg-white rounded-2xl p-8 shadow-2xl mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-neutral-800 mb-2">
                {task.title}
              </h1>

              {/* Deadline/Target */}
              {task.deadline && task.deadline !== 'none' && (
                <div className="flex items-center gap-2 text-error-600 font-medium mb-2">
                  <span className="text-lg">⏰</span>
                  <span>Deadline: {formatDeadline(task.deadline)}</span>
                </div>
              )}
              {task.target_date && task.target_date !== 'none' && (
                <div className="flex items-center gap-2 text-primary-600 font-medium mb-2">
                  <span className="text-lg">🎯</span>
                  <span>Target: {formatDeadline(task.target_date)}</span>
                </div>
              )}
            </div>

            <div className="text-6xl">🍅</div>
          </div>

          {/* Task Notes */}
          {task.notes && task.notes !== 'none' && task.notes.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-neutral-700 mb-2">Task Notes:</h3>
              <ul className="space-y-1">
                {task.notes.map((note, index) => (
                  <li key={index} className="text-neutral-600 flex items-start gap-2">
                    <span className="text-primary-500 mt-1">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Session Notes */}
          {pomodoro.notes && (
            <div className="border-t border-neutral-200 pt-4 mt-4">
              <h3 className="text-sm font-semibold text-neutral-700 mb-2">Session Focus:</h3>
              <p className="text-neutral-800 text-lg">{pomodoro.notes}</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          {isPaused ? (
            <button
              onClick={handleResume}
              className="px-8 py-4 bg-white text-error-600 rounded-xl font-semibold text-lg hover:bg-neutral-100 transition-colors shadow-lg"
            >
              ▶ Resume
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="px-8 py-4 bg-white text-error-600 rounded-xl font-semibold text-lg hover:bg-neutral-100 transition-colors shadow-lg"
            >
              ⏸ Pause
            </button>
          )}

          <button
            onClick={handleEnd}
            className="px-8 py-4 bg-white/20 text-white rounded-xl font-semibold text-lg hover:bg-white/30 transition-colors backdrop-blur-sm"
          >
            ✕ End Session
          </button>
        </div>

        {/* Keyboard Hint */}
        <div className="text-center mt-8 text-white/60 text-sm">
          Press ESC to end session
        </div>
      </div>
    </div>
  );
}

export default PomodoroFocusScreen;
