import { parseIdeas } from './markdownParser';

/**
 * Convert ideas array back to markdown format
 */
export function ideasToMarkdown(ideas) {
  const lines = [];

  ideas.forEach(idea => {
    // Main idea bullet
    lines.push(`- ${idea.text}`);

    // Detail bullets (indented)
    if (idea.details && idea.details.length > 0) {
      idea.details.forEach(detail => {
        lines.push(`  - ${detail}`);
      });
    }
  });

  return lines.join('\n');
}

/**
 * Save ideas back to ideas/inbox.md
 */
export async function saveIdeasToFile(ideas) {
  const header = [
    '# Ideas Inbox',
    '',
    'This file collects loose thoughts and ideas.',
    'Claude should not treat these as tasks unless Stefan asks to promote an idea.',
    '',
    '(Add ideas as simple bullet points.)',
    ''
  ];

  const content = [...header, ideasToMarkdown(ideas), ''].join('\n');

  const result = await window.electronAPI.writeFile('ideas/inbox.md', content);

  if (!result.success) {
    throw new Error(`Failed to save ideas: ${result.error}`);
  }

  return result;
}

/**
 * Add a new idea
 */
export async function addIdea(text, details = []) {
  // Read current ideas
  const result = await window.electronAPI.readFile('ideas/inbox.md');
  if (!result.success) {
    throw new Error('Failed to read ideas file');
  }

  const currentIdeas = parseIdeas(result.content);

  // Add new idea
  const newIdea = {
    text: text.trim(),
    details: details.filter(d => d.trim().length > 0)
  };

  const updatedIdeas = [...currentIdeas, newIdea];

  // Save back to file
  await saveIdeasToFile(updatedIdeas);

  return newIdea;
}

/**
 * Edit an existing idea
 */
export async function editIdea(index, newText, newDetails = []) {
  // Read current ideas
  const result = await window.electronAPI.readFile('ideas/inbox.md');
  if (!result.success) {
    throw new Error('Failed to read ideas file');
  }

  const currentIdeas = parseIdeas(result.content);

  if (index < 0 || index >= currentIdeas.length) {
    throw new Error('Invalid idea index');
  }

  // Update idea
  currentIdeas[index] = {
    text: newText.trim(),
    details: newDetails.filter(d => d.trim().length > 0)
  };

  // Save back to file
  await saveIdeasToFile(currentIdeas);

  return currentIdeas[index];
}

/**
 * Delete an idea
 */
export async function deleteIdea(index) {
  // Read current ideas
  const result = await window.electronAPI.readFile('ideas/inbox.md');
  if (!result.success) {
    throw new Error('Failed to read ideas file');
  }

  const currentIdeas = parseIdeas(result.content);

  if (index < 0 || index >= currentIdeas.length) {
    throw new Error('Invalid idea index');
  }

  // Remove idea
  const updatedIdeas = currentIdeas.filter((_, i) => i !== index);

  // Save back to file
  await saveIdeasToFile(updatedIdeas);

  return true;
}

/**
 * Promote idea to task
 * Creates a task and removes the idea from inbox
 */
export async function promoteIdeaToTask(idea, taskData, destination) {
  const { createTask } = await import('./fileWriter');

  // Read current tasks and headers
  const tasksResult = await window.electronAPI.readAllTasks();
  if (!tasksResult.success) {
    throw new Error('Failed to read tasks');
  }

  const { parseTaskFile, extractHeader } = await import('./markdownParser');
  const { today, dueSoon, backlog } = tasksResult.data;

  const tasks = {
    today: parseTaskFile(today),
    dueSoon: parseTaskFile(dueSoon),
    backlog: parseTaskFile(backlog)
  };

  const headers = {
    today: extractHeader(today),
    dueSoon: extractHeader(dueSoon),
    backlog: extractHeader(backlog)
  };

  // Create task from idea
  const newTaskData = {
    title: taskData.title || idea.text,
    deadline: taskData.deadline || 'none',
    target_date: taskData.target_date || 'none',
    priority: taskData.priority || 'none',
    notes: taskData.notes || idea.details || []
  };

  // Create task in destination column
  await createTask(newTaskData, destination, tasks, headers);

  // Remove idea from inbox (find index first)
  const ideasResult = await window.electronAPI.readFile('ideas/inbox.md');
  if (ideasResult.success) {
    const currentIdeas = parseIdeas(ideasResult.content);
    const ideaIndex = currentIdeas.findIndex(
      i => i.text === idea.text && JSON.stringify(i.details) === JSON.stringify(idea.details)
    );

    if (ideaIndex !== -1) {
      await deleteIdea(ideaIndex);
    }
  }

  return newTaskData;
}
