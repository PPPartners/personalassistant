import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { organizeTasks, parseRecurringTasks, prepareTasksForToday } from '../utils/startDayUtils';
import { formatDeadline } from '../utils/dateUtils';

function StartDayModal({ isOpen, onClose, todayTasks, overdueTasks, dueSoonTasks, backlogTasks, recurringMarkdown, onStartDay, onRescheduleTask }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTodayToMove, setSelectedTodayToMove] = useState(new Set());
  const [selectedRecurring, setSelectedRecurring] = useState(new Set());
  const [selectedOverdue, setSelectedOverdue] = useState(new Set());
  const [selectedDueSoon, setSelectedDueSoon] = useState(new Set());
  const [selectedBacklog, setSelectedBacklog] = useState(new Set());
  const [dueSoonTiers, setDueSoonTiers] = useState(null);
  const [backlogTiers, setBacklogTiers] = useState(null);
  const [recurringGroups, setRecurringGroups] = useState({});
  const [reschedulingTaskId, setReschedulingTaskId] = useState(null);

  // Define steps
  const steps = [
    { id: 1, title: 'Review Today', condition: todayTasks.length > 0 },
    { id: 2, title: 'Daily Recurring', condition: true },
    { id: 3, title: '⚠️ Overdue', condition: overdueTasks.length > 0 },
    { id: 4, title: 'Due Soon', condition: true },
    { id: 5, title: 'Backlog', condition: true }
  ];

  const activeSteps = steps.filter(s => s.condition);
  const totalSteps = activeSteps.length;
  const currentStepIndex = activeSteps.findIndex(s => s.id === currentStep);

  useEffect(() => {
    if (isOpen) {
      // Organize tasks
      setDueSoonTiers(organizeTasks(dueSoonTasks));
      setBacklogTiers(organizeTasks(backlogTasks));
      setRecurringGroups(parseRecurringTasks(recurringMarkdown));

      // Reset selections
      setSelectedTodayToMove(new Set());
      setSelectedRecurring(new Set());
      setSelectedOverdue(new Set());
      setSelectedDueSoon(new Set());
      setSelectedBacklog(new Set());

      // Set initial step (skip review if today is empty)
      setCurrentStep(todayTasks.length > 0 ? 1 : 2);
    }
  }, [isOpen, todayTasks, overdueTasks, dueSoonTasks, backlogTasks, recurringMarkdown]);

  if (!isOpen || !dueSoonTiers || !backlogTiers) return null;

  const toggleSelection = (set, setter, taskId) => {
    const newSet = new Set(set);
    if (newSet.has(taskId)) {
      newSet.delete(taskId);
    } else {
      newSet.add(taskId);
    }
    setter(newSet);
  };

  const handleNext = () => {
    const nextStepIndex = currentStepIndex + 1;
    if (nextStepIndex < totalSteps) {
      setCurrentStep(activeSteps[nextStepIndex].id);
    }
  };

  const handleBack = () => {
    const prevStepIndex = currentStepIndex - 1;
    if (prevStepIndex >= 0) {
      setCurrentStep(activeSteps[prevStepIndex].id);
    }
  };

  const handleReschedule = async (task, newDate, column) => {
    try {
      // Update the task with new date
      const updatedTask = {
        ...task,
        // If task has a deadline, update deadline, otherwise update target_date
        ...(task.deadline !== 'none'
          ? { deadline: newDate }
          : { target_date: newDate }
        )
      };

      await onRescheduleTask(updatedTask, column);
      setReschedulingTaskId(null);
    } catch (error) {
      console.error('Error rescheduling task:', error);
      alert('Failed to reschedule task: ' + error.message);
    }
  };

  const handleFinish = () => {
    // Collect tasks to add to today
    const allRecurring = Object.values(recurringGroups).flat();
    const selectedRecurringTasks = allRecurring.filter(t => selectedRecurring.has(t.id));

    const selectedOverdueTasks = overdueTasks.filter(t => selectedOverdue.has(t.id));

    const allDueSoon = [
      ...dueSoonTiers.urgent,
      ...dueSoonTiers.important,
      ...dueSoonTiers.targetSoon,
      ...dueSoonTiers.targetLater,
      ...dueSoonTiers.backlog
    ];
    const selectedDueSoonTasks = allDueSoon.filter(t => selectedDueSoon.has(t.id));

    const allBacklog = [
      ...backlogTiers.urgent,
      ...backlogTiers.important,
      ...backlogTiers.targetSoon,
      ...backlogTiers.targetLater,
      ...backlogTiers.backlog
    ];
    const selectedBacklogTasks = allBacklog.filter(t => selectedBacklog.has(t.id));

    const allSelected = [...selectedOverdueTasks, ...selectedDueSoonTasks, ...selectedBacklogTasks];
    const tasksToAdd = prepareTasksForToday(allSelected, selectedRecurringTasks);

    // Collect tasks to move from today to backlog
    const tasksToMoveToBacklog = todayTasks.filter(t => selectedTodayToMove.has(t.id));

    onStartDay({ tasksToAdd, tasksToMoveToBacklog });
    onClose();
  };

  // Progress Indicator
  const ProgressIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {activeSteps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            index < currentStepIndex ? 'bg-success-500 text-white' :
            index === currentStepIndex ? 'bg-primary-500 text-white' :
            'bg-neutral-200 text-neutral-500'
          }`}>
            {index < currentStepIndex ? '✓' : index + 1}
          </div>
          {index < totalSteps - 1 && (
            <div className={`w-12 h-0.5 ${index < currentStepIndex ? 'bg-success-500' : 'bg-neutral-200'}`} />
          )}
        </div>
      ))}
    </div>
  );

  // Task Checkbox Component
  const TaskCheckbox = ({ task, isSelected, onToggle, onReschedule, column }) => {
    const isRescheduling = reschedulingTaskId === task.id;
    const currentDate = task.deadline !== 'none' ? task.deadline : task.target_date;

    return (
      <div className="flex items-start gap-2 p-2 hover:bg-dark-hover rounded">
        <label className="flex items-start gap-2 flex-1 cursor-pointer">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggle(task.id)}
            className="mt-1 w-4 h-4 text-primary-600 rounded border-dark-border"
          />
          <div className="flex-1">
            <div className="font-medium text-sm text-text-primary">{task.title}</div>
            {isRescheduling ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="date"
                  defaultValue={currentDate}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    if (e.target.value) {
                      onReschedule(task, e.target.value, column);
                    }
                  }}
                  className="text-xs px-2 py-1 bg-dark-base border border-primary-300 text-text-primary rounded focus:outline-none focus:ring-1 focus:ring-primary-500 [color-scheme:dark]"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setReschedulingTaskId(null);
                  }}
                  className="text-xs text-text-tertiary hover:text-text-secondary"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="text-xs text-text-tertiary">
                {task.deadline !== 'none' && `⏰ ${formatDeadline(task.deadline)}`}
                {task.target_date !== 'none' && `🎯 ${formatDeadline(task.target_date)}`}
              </div>
            )}
          </div>
        </label>
        {onReschedule && !isRescheduling && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setReschedulingTaskId(task.id);
            }}
            className="flex-shrink-0 p-1.5 text-text-tertiary hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
            title="Reschedule"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
        )}
      </div>
    );
  };

  // Tier Section Component
  const TierSection = ({ title, icon, tasks, bgColor, selectedSet, onToggle, onReschedule, column }) => {
    if (tasks.length === 0) return null;
    return (
      <div className="mb-4">
        <h4 className={`text-sm font-semibold ${bgColor} px-3 py-2 rounded flex items-center gap-2`}>
          <span>{icon}</span>
          <span>{title}</span>
          <span className="text-xs opacity-75">({tasks.length})</span>
        </h4>
        <div className="mt-2 space-y-1">
          {tasks.map(task => (
            <TaskCheckbox
              key={task.id}
              task={task}
              isSelected={selectedSet.has(task.id)}
              onToggle={onToggle}
              onReschedule={onReschedule}
              column={column}
            />
          ))}
        </div>
      </div>
    );
  };

  const categoryLabels = {
    fitness: '💪 Fitness',
    health: '🏥 Health',
    work: '💼 Work',
    skills: '🎯 Skills',
    learning: '📚 Learning',
    other: '📝 Other'
  };

  // Step 1: Review Today
  const StepReviewToday = () => (
    <div className="py-4">
      <h3 className="text-lg font-semibold text-text-primary mb-4">📋 Already on Your Plate</h3>
      <p className="text-sm text-text-secondary mb-4">
        These tasks are already in today. Click the arrow to move any to backlog.
      </p>
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 space-y-2 max-h-96 overflow-y-auto">
        {todayTasks.map(task => {
          const isMarkedForMove = selectedTodayToMove.has(task.id);
          return (
            <div
              key={task.id}
              className={`flex items-start gap-3 bg-dark-base rounded p-3 transition-all ${
                isMarkedForMove ? 'opacity-50 bg-dark-hover' : ''
              }`}
            >
              <div className="flex-1">
                <div className="font-medium text-text-primary">{task.title}</div>
                {task.days_in_today > 1 && (
                  <div className="text-xs text-warning-600 mt-1">📌 Day {task.days_in_today}</div>
                )}
                {(task.deadline !== 'none' || task.target_date !== 'none') && (
                  <div className="text-xs text-text-tertiary mt-1">
                    {task.deadline !== 'none' && `⏰ ${formatDeadline(task.deadline)}`}
                    {task.target_date !== 'none' && `🎯 ${formatDeadline(task.target_date)}`}
                  </div>
                )}
              </div>
              <button
                onClick={() => toggleSelection(selectedTodayToMove, setSelectedTodayToMove, task.id)}
                className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                  isMarkedForMove
                    ? 'bg-success-100 text-success-700 hover:bg-success-200'
                    : 'bg-dark-hover text-text-tertiary hover:bg-danger-100 hover:text-danger-600'
                }`}
                title={isMarkedForMove ? 'Keep in today' : 'Move to backlog'}
              >
                {isMarkedForMove ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                )}
              </button>
            </div>
          );
        })}
      </div>
      {selectedTodayToMove.size > 0 && (
        <div className="text-sm text-text-secondary mt-4 bg-danger-50 border border-danger-200 rounded p-3">
          <span className="font-medium text-danger-700">{selectedTodayToMove.size}</span> task(s) will be moved to backlog
        </div>
      )}
    </div>
  );

  // Step 2: Daily Recurring
  const StepRecurring = () => (
    <div className="py-4">
      <h3 className="text-lg font-semibold text-text-primary mb-4">🔄 Daily Recurring Tasks</h3>
      <p className="text-sm text-text-secondary mb-4">Select optional habits and routines for today:</p>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {Object.entries(recurringGroups).map(([category, tasks]) => (
          <div key={category}>
            <h4 className="text-sm font-semibold text-text-secondary mb-2">
              {categoryLabels[category] || category}
            </h4>
            <div className="space-y-1">
              {tasks.map(task => (
                <label key={task.id} className="flex items-center gap-2 p-2 hover:bg-dark-hover rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRecurring.has(task.id)}
                    onChange={() => toggleSelection(selectedRecurring, setSelectedRecurring, task.id)}
                    className="w-4 h-4 text-primary-600 rounded border-dark-border"
                  />
                  <span className="text-sm text-text-primary">{task.title}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="text-sm text-text-tertiary mt-4">
        Selected: {selectedRecurring.size} recurring tasks
      </div>
    </div>
  );

  // Step 3: Overdue
  const StepOverdue = () => (
    <div className="py-4">
      <h3 className="text-lg font-semibold text-text-primary mb-4">⚠️ Overdue Tasks</h3>
      <p className="text-sm text-danger-600 font-medium mb-4">
        These tasks have passed their deadline or target date. Consider adding them to today or rescheduling.
      </p>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-3">
          {overdueTasks.length === 0 ? (
            <p className="text-sm text-text-tertiary text-center">No overdue tasks</p>
          ) : (
            <div className="space-y-1">
              {overdueTasks.map(task => (
                <TaskCheckbox
                  key={task.id}
                  task={task}
                  isSelected={selectedOverdue.has(task.id)}
                  onToggle={(id) => toggleSelection(selectedOverdue, setSelectedOverdue, id)}
                  onReschedule={handleReschedule}
                  column="overdue"
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="text-sm text-text-tertiary mt-4">
        Selected: {selectedOverdue.size} overdue tasks
      </div>
    </div>
  );

  // Step 4: Due Soon
  const StepDueSoon = () => (
    <div className="py-4">
      <h3 className="text-lg font-semibold text-text-primary mb-4">⏰ Due Soon</h3>
      <p className="text-sm text-text-secondary mb-4">Select tasks with upcoming deadlines:</p>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        <TierSection
          title="Urgent"
          icon="🔴"
          tasks={dueSoonTiers.urgent}
          bgColor="bg-error-100 text-error-800"
          selectedSet={selectedDueSoon}
          onToggle={(id) => toggleSelection(selectedDueSoon, setSelectedDueSoon, id)}
          onReschedule={handleReschedule}
          column="dueSoon"
        />
        <TierSection
          title="Important"
          icon="🟡"
          tasks={dueSoonTiers.important}
          bgColor="bg-warning-100 text-warning-800"
          selectedSet={selectedDueSoon}
          onToggle={(id) => toggleSelection(selectedDueSoon, setSelectedDueSoon, id)}
          onReschedule={handleReschedule}
          column="dueSoon"
        />
        <TierSection
          title="Target Soon"
          icon="🟢"
          tasks={dueSoonTiers.targetSoon}
          bgColor="bg-success-100 text-success-800"
          selectedSet={selectedDueSoon}
          onToggle={(id) => toggleSelection(selectedDueSoon, setSelectedDueSoon, id)}
          onReschedule={handleReschedule}
          column="dueSoon"
        />
        <TierSection
          title="Target Later"
          icon="🔵"
          tasks={dueSoonTiers.targetLater}
          bgColor="bg-info-100 text-info-800"
          selectedSet={selectedDueSoon}
          onToggle={(id) => toggleSelection(selectedDueSoon, setSelectedDueSoon, id)}
          onReschedule={handleReschedule}
          column="dueSoon"
        />
      </div>
      <div className="text-sm text-text-tertiary mt-4">
        Selected: {selectedDueSoon.size} tasks from Due Soon
      </div>
    </div>
  );

  // Step 4: Backlog
  const StepBacklog = () => (
    <div className="py-4">
      <h3 className="text-lg font-semibold text-text-primary mb-4">📊 Backlog</h3>
      <p className="text-sm text-text-secondary mb-4">Select additional tasks to work on:</p>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        <TierSection
          title="With Target Dates"
          icon="🎯"
          tasks={[...backlogTiers.targetSoon, ...backlogTiers.targetLater]}
          bgColor="bg-info-100 text-info-800"
          selectedSet={selectedBacklog}
          onToggle={(id) => toggleSelection(selectedBacklog, setSelectedBacklog, id)}
        />
        <TierSection
          title="No Specific Date"
          icon="⚪"
          tasks={backlogTiers.backlog}
          bgColor="bg-neutral-100 text-neutral-800"
          selectedSet={selectedBacklog}
          onToggle={(id) => toggleSelection(selectedBacklog, setSelectedBacklog, id)}
        />
      </div>
      <div className="text-sm text-text-tertiary mt-4">
        Selected: {selectedBacklog.size} tasks from Backlog
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-elevated rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-text-primary">📅 Start Your Day</h2>
              <p className="text-sm text-text-secondary">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
            </div>
            <button
              onClick={onClose}
              className="text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-4">
            <ProgressIndicator />
            <p className="text-center text-sm font-medium text-text-secondary">
              {activeSteps[currentStepIndex].title}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6">
          {currentStep === 1 && <StepReviewToday />}
          {currentStep === 2 && <StepRecurring />}
          {currentStep === 3 && <StepOverdue />}
          {currentStep === 4 && <StepDueSoon />}
          {currentStep === 5 && <StepBacklog />}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-dark-border flex items-center justify-between">
          <div className="text-sm text-text-secondary">
            Total selected: {selectedRecurring.size + selectedOverdue.size + selectedDueSoon.size + selectedBacklog.size} tasks
          </div>
          <div className="flex gap-3">
            {currentStepIndex > 0 && (
              <button
                onClick={handleBack}
                className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                Back
              </button>
            )}
            {currentStepIndex < totalSteps - 1 ? (
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="px-6 py-2 bg-success-500 text-white rounded-lg hover:bg-success-600 transition-colors font-medium"
              >
                Start Day
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StartDayModal;
