import React, { useState, useEffect } from 'react';
import { parseTaskFile, extractHeader, parseIdeas } from './utils/markdownParser';
import { markTaskDone, moveTask, updateTask, deleteTask } from './utils/fileWriter';
import TodayGrid from './components/TodayGrid';
import AllTasksView from './components/AllTasksView';
import ClaudeTerminal from './components/ClaudeTerminal';
import TaskDetailPanel from './components/TaskDetailPanel';
import StartDayModal from './components/StartDayModal';
import EndDayModal from './components/EndDayModal';
import QuickAddTaskModal from './components/QuickAddTaskModal';
import IdeasView from './components/IdeasView';
import ArchiveView from './components/ArchiveView';
import PromoteIdeaModal from './components/PromoteIdeaModal';
import RestoreTaskModal from './components/RestoreTaskModal';
import Header from './components/Header';
import ViewNavigation from './components/ViewNavigation';
import ScheduleSidebar from './components/ScheduleSidebar';
import ScheduleTaskModal from './components/ScheduleTaskModal';
import PomodoroSetupModal from './components/PomodoroSetupModal';
import PomodoroFocusScreen from './components/PomodoroFocusScreen';
import QuickPomodoroModal from './components/QuickPomodoroModal';
import UpdateNotification from './components/UpdateNotification';

function App() {
  const [tasks, setTasks] = useState({
    today: [],
    dueSoon: [],
    backlog: [],
    overdue: []
  });

  const [headers, setHeaders] = useState({
    today: [],
    dueSoon: [],
    backlog: [],
    overdue: []
  });

  const [settings, setSettings] = useState(null);
  const [recurringMarkdown, setRecurringMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [currentView, setCurrentView] = useState('today');
  const [showStartDayModal, setShowStartDayModal] = useState(false);
  const [showEndDayModal, setShowEndDayModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [ideas, setIdeas] = useState([]);
  const [archivedTasks, setArchivedTasks] = useState({ done: [], dropped: [] });
  const [showPromoteIdeaModal, setShowPromoteIdeaModal] = useState(false);
  const [showRestoreTaskModal, setShowRestoreTaskModal] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [selectedArchivedTask, setSelectedArchivedTask] = useState(null);
  const [archiveType, setArchiveType] = useState('done');
  const [schedule, setSchedule] = useState({ date: '', meetings: [], scheduledTasks: [] });
  const [showScheduleTaskModal, setShowScheduleTaskModal] = useState(false);
  const [taskToSchedule, setTaskToSchedule] = useState(null);
  const [alertedMeetings, setAlertedMeetings] = useState(new Set());
  const [draggedItem, setDraggedItem] = useState(null);
  const [showPomodoroSetup, setShowPomodoroSetup] = useState(false);
  const [showQuickPomodoroModal, setShowQuickPomodoroModal] = useState(false);
  const [quickPomodoroTask, setQuickPomodoroTask] = useState(null);
  const [pomodoro, setPomodoro] = useState(null);

  // Load all tasks on mount
  useEffect(() => {
    const initializeApp = async () => {
      // Auto-migrate overdue tasks first
      const { autoMigrateToOverdue, autoMigrateBacklogToDueSoon } = await import('./utils/fileWriter');
      const overdueCount = await autoMigrateToOverdue();

      // Then migrate backlog to due_soon
      await autoMigrateBacklogToDueSoon();

      // Load all data
      loadAllTasks();
      loadIdeas();
      loadArchive();
      loadTodaySchedule();

      // Log warning if there are overdue tasks
      if (overdueCount > 0) {
        console.warn(`⚠️  You have ${overdueCount} overdue task(s)!`);
      }
    };

    initializeApp();

    // Listen for file changes from Claude Code
    if (window.electronAPI) {
      window.electronAPI.onFileChanged((filePath) => {
        console.log('File changed:', filePath);
        loadAllTasks();

        // Reload ideas if ideas file changed
        if (filePath.includes('ideas/inbox.md')) {
          loadIdeas();
        }

        // Reload archive if archive files changed
        if (filePath.includes('archive/')) {
          loadArchive();
        }

        // Reload schedule if schedule files changed
        if (filePath.includes('schedule/')) {
          loadTodaySchedule();
        }
      });
    }
  }, []);

  const loadAllTasks = async () => {
    try {
      const result = await window.electronAPI.readAllTasks();

      if (result.success) {
        const { today, dueSoon, backlog, overdue, settings: settingsData, recurring } = result.data;

        console.log('📄 Raw overdue content length:', overdue?.length || 0);
        console.log('📄 First 200 chars of overdue:', overdue?.substring(0, 200));

        const parsedOverdue = parseTaskFile(overdue || '');
        console.log('📋 Loaded overdue tasks:', parsedOverdue.length, parsedOverdue);

        setTasks({
          today: parseTaskFile(today),
          dueSoon: parseTaskFile(dueSoon),
          backlog: parseTaskFile(backlog),
          overdue: parsedOverdue
        });

        setHeaders({
          today: extractHeader(today),
          dueSoon: extractHeader(dueSoon),
          backlog: extractHeader(backlog),
          overdue: extractHeader(overdue || '')
        });

        setSettings(settingsData);
        setRecurringMarkdown(recurring);
      } else {
        console.error('Failed to load tasks:', result.error);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadIdeas = async () => {
    try {
      const result = await window.electronAPI.readFile('ideas/inbox.md');
      if (result.success) {
        setIdeas(parseIdeas(result.content));
      }
    } catch (error) {
      console.error('Error loading ideas:', error);
    }
  };

  const loadArchive = async () => {
    try {
      const [doneResult, droppedResult] = await Promise.all([
        window.electronAPI.readFile('archive/done.md'),
        window.electronAPI.readFile('archive/dropped.md')
      ]);

      setArchivedTasks({
        done: doneResult.success ? parseTaskFile(doneResult.content) : [],
        dropped: droppedResult.success ? parseTaskFile(droppedResult.content) : []
      });
    } catch (error) {
      console.error('Error loading archive:', error);
    }
  };

  const loadTodaySchedule = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const result = await window.electronAPI.readSchedule(today);
      if (result.success) {
        setSchedule(result.schedule);
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
    }
  };

  const handleViewTask = (task, column) => {
    setSelectedTask(task);
    setSelectedColumn(column);
  };

  const handleCloseDetail = () => {
    setSelectedTask(null);
    setSelectedColumn(null);
  };

  const handleSaveTask = async (updatedTask) => {
    try {
      await updateTask(updatedTask, selectedColumn, tasks, headers);

      // Reload all tasks to ensure UI is in sync
      // (task may have auto-moved between dueSoon and backlog based on dates)
      await loadAllTasks();

      setSelectedTask(updatedTask);
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Failed to save task: ' + error.message);
    }
  };

  const handleMarkDone = async (task, column) => {
    try {
      await markTaskDone(task, column, tasks, headers);

      // Remove from current column
      setTasks(prev => ({
        ...prev,
        [column]: prev[column].filter(t => t.id !== task.id)
      }));

      // Close detail panel if open
      if (selectedTask?.id === task.id) {
        handleCloseDetail();
      }

      console.log('Task marked as done:', task.title);
    } catch (error) {
      console.error('Error marking task done:', error);
      alert('Failed to mark task as done: ' + error.message);
    }
  };

  const handleMarkDropped = async (task, column) => {
    try {
      const { markTaskDropped } = await import('./utils/fileWriter');
      await markTaskDropped(task, column, tasks, headers);

      // Remove from current column
      setTasks(prev => ({
        ...prev,
        [column]: prev[column].filter(t => t.id !== task.id)
      }));

      // Close detail panel if open
      if (selectedTask?.id === task.id) {
        handleCloseDetail();
      }

      console.log('Task marked as dropped:', task.title);
    } catch (error) {
      console.error('Error marking task dropped:', error);
      alert('Failed to mark task as dropped: ' + error.message);
    }
  };

  const handleMoveTask = async (task, fromColumn, toColumn) => {
    try {
      const updatedTask = await moveTask(task, fromColumn, toColumn, tasks, headers);

      // Update local state
      setTasks(prev => ({
        ...prev,
        [fromColumn]: prev[fromColumn].filter(t => t.id !== task.id),
        [toColumn]: [...prev[toColumn], updatedTask]
      }));

      // Close detail panel
      handleCloseDetail();

      console.log(`Task moved from ${fromColumn} to ${toColumn}`);
    } catch (error) {
      console.error('Error moving task:', error);
      alert('Failed to move task: ' + error.message);
    }
  };


  const handleDeleteTask = async (task, column) => {
    try {
      await deleteTask(task, column, tasks, headers);

      // Remove from local state
      setTasks(prev => ({
        ...prev,
        [column]: prev[column].filter(t => t.id !== task.id)
      }));

      // Close detail panel
      handleCloseDetail();

      console.log('Task deleted:', task.title);
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task: ' + error.message);
    }
  };

  const handleStartDay = async ({ tasksToAdd, tasksToMoveToBacklog }) => {
    try {
      const { addTasksToToday, moveTask } = await import('./utils/fileWriter');

      // First, move selected today tasks to backlog
      if (tasksToMoveToBacklog && tasksToMoveToBacklog.length > 0) {
        for (const task of tasksToMoveToBacklog) {
          await moveTask(task, 'today', 'backlog', tasks, headers);
        }
      }

      // Then add selected tasks to today
      if (tasksToAdd && tasksToAdd.length > 0) {
        // Remove tasks that were just moved to backlog from tasks.today
        const remainingTodayTasks = tasks.today.filter(
          t => !tasksToMoveToBacklog?.some(moved => moved.id === t.id)
        );
        await addTasksToToday(tasksToAdd, remainingTodayTasks, headers.today);
      }

      // Reload all tasks to reflect changes
      await loadAllTasks();

      console.log(`Start Day: Added ${tasksToAdd?.length || 0} tasks, moved ${tasksToMoveToBacklog?.length || 0} to backlog`);
    } catch (error) {
      console.error('Error starting day:', error);
      alert('Failed to start day: ' + error.message);
    }
  };

  const handleQuickPriorityChange = async (task, newPriority) => {
    try {
      const updatedTask = { ...task, priority: newPriority };

      await updateTask(updatedTask, 'today', tasks, headers);

      // Update local state immediately for responsive UI
      setTasks(prev => ({
        ...prev,
        today: prev.today.map(t =>
          t.id === task.id ? updatedTask : t
        )
      }));

      console.log(`Changed priority of "${task.title}" to ${newPriority}`);
    } catch (error) {
      console.error('Error changing priority:', error);
      alert('Failed to change priority: ' + error.message);
    }
  };

  const handleEndDay = async (decisions) => {
    try {
      const { processEndDayDecisions } = await import('./utils/endDayUtils');
      const { saveEndDayResults } = await import('./utils/fileWriter');

      // Process decisions and get updated task lists
      const result = await processEndDayDecisions(decisions, tasks.today, tasks, headers);

      // Save to files
      await saveEndDayResults(result.today, result.backlog, headers);

      // Reload all tasks to reflect changes
      await loadAllTasks();

      console.log(`End of day: ${decisions.keep.length} kept, ${decisions.moveToBacklog.length} moved to backlog`);
    } catch (error) {
      console.error('Error ending day:', error);
      alert('Failed to end day: ' + error.message);
    }
  };

  const handleQuickAddTask = async (taskData) => {
    try {
      const { createTask } = await import('./utils/fileWriter');

      // Create task and add to today
      const newTask = await createTask(taskData, 'today', tasks, headers);

      // Update local state immediately for responsive UI
      setTasks(prev => ({
        ...prev,
        today: [...prev.today, newTask]
      }));

      console.log(`Created task: "${newTask.title}"`);
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task: ' + error.message);
    }
  };

  // Ideas handlers
  const handleAddIdea = async (text, details) => {
    try {
      const { addIdea } = await import('./utils/ideaUtils');
      await addIdea(text, details);
      await loadIdeas();
    } catch (error) {
      console.error('Error adding idea:', error);
      alert('Failed to add idea: ' + error.message);
    }
  };

  const handleEditIdea = async (index, text, details) => {
    try {
      const { editIdea } = await import('./utils/ideaUtils');
      await editIdea(index, text, details);
      await loadIdeas();
    } catch (error) {
      console.error('Error editing idea:', error);
      alert('Failed to edit idea: ' + error.message);
    }
  };

  const handleDeleteIdea = async (index) => {
    try {
      const { deleteIdea } = await import('./utils/ideaUtils');
      await deleteIdea(index);
      await loadIdeas();
    } catch (error) {
      console.error('Error deleting idea:', error);
      alert('Failed to delete idea: ' + error.message);
    }
  };

  const handlePromoteIdea = async (idea, taskData, destination) => {
    try {
      const { promoteIdeaToTask } = await import('./utils/ideaUtils');
      await promoteIdeaToTask(idea, taskData, destination);
      await loadIdeas();
      await loadAllTasks();
      console.log(`Promoted idea "${idea.text}" to task`);
    } catch (error) {
      console.error('Error promoting idea:', error);
      alert('Failed to promote idea: ' + error.message);
    }
  };

  // Archive handlers
  const handleRestoreTask = async (task, destination) => {
    try {
      const { restoreTask } = await import('./utils/archiveUtils');
      await restoreTask(task, destination, archiveType);
      await loadArchive();
      await loadAllTasks();
      console.log(`Restored task "${task.title}" to ${destination}`);
    } catch (error) {
      console.error('Error restoring task:', error);
      alert('Failed to restore task: ' + error.message);
    }
  };

  const handlePermanentlyDelete = async (task, type) => {
    try {
      const { permanentlyDeleteTask } = await import('./utils/archiveUtils');
      await permanentlyDeleteTask(task, type);
      await loadArchive();
      console.log(`Permanently deleted task "${task.title}"`);
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task: ' + error.message);
    }
  };

  const handleRescheduleTask = async (updatedTask, column) => {
    try {
      await updateTask(updatedTask, column, tasks, headers);
      await loadAllTasks();
      console.log(`Rescheduled task "${updatedTask.title}"`);
    } catch (error) {
      console.error('Error rescheduling task:', error);
      alert('Failed to reschedule task: ' + error.message);
    }
  };

  const handleUpdateSchedule = async (updatedSchedule) => {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const result = await window.electronAPI.writeSchedule(today, updatedSchedule);
      if (result.success) {
        setSchedule(updatedSchedule);
        console.log('Schedule updated');
      }
    } catch (error) {
      console.error('Error updating schedule:', error);
      alert('Failed to update schedule: ' + error.message);
    }
  };

  const handleScheduleTask = (task) => {
    setTaskToSchedule(task);
    setShowScheduleTaskModal(true);
  };

  const handleSaveScheduledTask = async (scheduleData) => {
    try {
      const updatedScheduledTasks = [...(schedule.scheduledTasks || []), scheduleData];
      const updatedSchedule = {
        ...schedule,
        scheduledTasks: updatedScheduledTasks
      };
      await handleUpdateSchedule(updatedSchedule);
      console.log('Task scheduled:', scheduleData);
    } catch (error) {
      console.error('Error scheduling task:', error);
      alert('Failed to schedule task: ' + error.message);
    }
  };

  // Pomodoro handlers
  const handleStartPomodoro = () => {
    setShowPomodoroSetup(true);
  };

  const handlePomodoroStart = (pomodoroData) => {
    setPomodoro({
      ...pomodoroData,
      remainingTime: pomodoroData.duration,
      startTime: Date.now(),
      isPaused: false
    });
    setShowPomodoroSetup(false);
  };

  const handlePomodoroPause = (timeLeft) => {
    setPomodoro(prev => ({
      ...prev,
      remainingTime: timeLeft,
      isPaused: true
    }));
  };

  const handlePomodoroResume = () => {
    setPomodoro(prev => ({
      ...prev,
      isPaused: false
    }));
  };

  const handlePomodoroEnd = () => {
    setPomodoro(null);
  };

  const handleToggleTodayStatus = async (task, column) => {
    try {
      let destination;

      if (column === 'today') {
        // Moving FROM today - determine appropriate destination
        const { determineDestinationColumn } = await import('./utils/dateUtils');
        destination = determineDestinationColumn(task);
        console.log(`Moving "${task.title}" from today to ${destination}`);
      } else {
        // Moving TO today from any other column
        destination = 'today';
        console.log(`Moving "${task.title}" to today`);
      }

      await handleMoveTask(task, column, destination);
    } catch (error) {
      console.error('Error toggling today status:', error);
      alert('Failed to move task: ' + error.message);
    }
  };

  const handleStartPomodoroFromCard = (task) => {
    setQuickPomodoroTask(task);
    setShowQuickPomodoroModal(true);
  };

  // Keyboard shortcut for ESC to exit Pomodoro
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && pomodoro) {
        if (confirm('Are you sure you want to end this Pomodoro session?')) {
          handlePomodoroEnd();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pomodoro]);

  const handleTaskDragStart = (item, dragStartY, itemTop) => {
    const grabOffset = dragStartY - itemTop;
    setDraggedItem({ ...item, grabOffset });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-dark-base">
        <div className="text-text-secondary text-lg">Loading tasks...</div>
      </div>
    );
  }

  const maxTasksToday = settings?.max_tasks_today || 8;

  return (
    <div className="h-screen flex flex-col bg-dark-base">
      <Header
        currentFocus={settings?.current_focus}
        onStartDay={() => setShowStartDayModal(true)}
        onEndDay={() => setShowEndDayModal(true)}
        onShowFocus={() => console.log('Show focus')}
        onStartPomodoro={handleStartPomodoro}
      />

      {/* View Navigation */}
      <ViewNavigation
        currentView={currentView}
        onViewChange={setCurrentView}
      />

      {/* Main Content - Horizontal Split with Sidebar */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Section - Swappable Views (60%) */}
          <div className="flex-[3] overflow-hidden">
          {currentView === 'today' && (
            <TodayGrid
              tasks={tasks.today}
              maxTasks={maxTasksToday}
              onViewTask={handleViewTask}
              onMarkDone={handleMarkDone}
              onMarkDropped={handleMarkDropped}
              onQuickPriorityChange={handleQuickPriorityChange}
              onQuickAdd={() => setShowQuickAddModal(true)}
              onScheduleTask={handleScheduleTask}
              onToggleTodayStatus={handleToggleTodayStatus}
              onStartPomodoro={handleStartPomodoroFromCard}
            />
          )}

          {currentView === 'all-tasks' && (
            <AllTasksView
              tasks={tasks}
              onViewTask={handleViewTask}
            />
          )}

          {currentView === 'ideas' && (
            <IdeasView
              ideas={ideas}
              onAdd={handleAddIdea}
              onEdit={handleEditIdea}
              onDelete={handleDeleteIdea}
              onPromote={(idea) => {
                setSelectedIdea(idea);
                setShowPromoteIdeaModal(true);
              }}
            />
          )}

          {currentView === 'archive' && (
            <ArchiveView
              archivedTasks={archivedTasks}
              onRestore={(task, type) => {
                setSelectedArchivedTask(task);
                setArchiveType(type);
                setShowRestoreTaskModal(true);
              }}
              onDelete={handlePermanentlyDelete}
            />
          )}
        </div>

        {/* Divider */}
        <div className="h-1 bg-dark-border hover:bg-primary-500/50 cursor-row-resize transition-colors" />

          {/* Claude Terminal - Bottom 40% (Always Visible) */}
          <div className="flex-[2] overflow-hidden">
            <ClaudeTerminal />
          </div>
        </div>

        {/* Right: Schedule Sidebar */}
        <ScheduleSidebar
          schedule={schedule}
          onUpdateSchedule={handleUpdateSchedule}
          draggedItem={draggedItem}
          setDraggedItem={setDraggedItem}
          todayTasks={tasks.today}
        />
      </main>

      {/* Task Detail Panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          column={selectedColumn}
          onClose={handleCloseDetail}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onMarkDone={handleMarkDone}
          onMove={handleMoveTask}
          onMarkDropped={handleMarkDropped}
          onMoveToBacklog={handleToggleTodayStatus}
          onStartPomodoro={handleStartPomodoroFromCard}
        />
      )}

      {/* Start Day Modal */}
      <StartDayModal
        isOpen={showStartDayModal}
        onClose={() => setShowStartDayModal(false)}
        todayTasks={tasks.today}
        overdueTasks={tasks.overdue}
        dueSoonTasks={tasks.dueSoon}
        backlogTasks={tasks.backlog}
        recurringMarkdown={recurringMarkdown}
        onStartDay={handleStartDay}
        onRescheduleTask={handleRescheduleTask}
      />

      {/* End Day Modal */}
      <EndDayModal
        isOpen={showEndDayModal}
        onClose={() => setShowEndDayModal(false)}
        todayTasks={tasks.today}
        onEndDay={handleEndDay}
      />

      {/* Quick Add Task Modal */}
      <QuickAddTaskModal
        isOpen={showQuickAddModal}
        onClose={() => setShowQuickAddModal(false)}
        onAdd={handleQuickAddTask}
      />

      {/* Promote Idea Modal */}
      <PromoteIdeaModal
        isOpen={showPromoteIdeaModal}
        onClose={() => setShowPromoteIdeaModal(false)}
        idea={selectedIdea}
        onPromote={handlePromoteIdea}
      />

      {/* Restore Task Modal */}
      <RestoreTaskModal
        isOpen={showRestoreTaskModal}
        onClose={() => setShowRestoreTaskModal(false)}
        task={selectedArchivedTask}
        onRestore={handleRestoreTask}
      />

      {/* Schedule Task Modal */}
      <ScheduleTaskModal
        isOpen={showScheduleTaskModal}
        onClose={() => {
          setShowScheduleTaskModal(false);
          setTaskToSchedule(null);
        }}
        task={taskToSchedule}
        onSchedule={handleSaveScheduledTask}
      />

      {/* Pomodoro Setup Modal */}
      <PomodoroSetupModal
        isOpen={showPomodoroSetup}
        onClose={() => setShowPomodoroSetup(false)}
        onStart={handlePomodoroStart}
        currentFocusTask={settings?.current_focus ?
          tasks.today.find(t => t.id === settings.current_focus)
          : null}
        todayTasks={tasks.today}
        meetings={schedule.meetings || []}
      />

      {/* Quick Pomodoro Modal (from task cards) */}
      <QuickPomodoroModal
        isOpen={showQuickPomodoroModal}
        onClose={() => {
          setShowQuickPomodoroModal(false);
          setQuickPomodoroTask(null);
        }}
        task={quickPomodoroTask}
        onStart={handlePomodoroStart}
      />

      {/* Pomodoro Focus Screen */}
      {pomodoro && (
        <PomodoroFocusScreen
          pomodoro={pomodoro}
          onPause={handlePomodoroPause}
          onResume={handlePomodoroResume}
          onEnd={handlePomodoroEnd}
        />
      )}

      {/* Update Notification */}
      <UpdateNotification />
    </div>
  );
}

export default App;
