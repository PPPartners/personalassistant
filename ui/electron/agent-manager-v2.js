import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';
import TurndownService from 'turndown';

/**
 * Agent Manager V2 - Robust implementation using Claude API directly
 *
 * Key improvements over V1:
 * - No PTY/terminal scraping
 * - Structured tool use instead of ANSI parsing
 * - Native conversation state management
 * - Clean human-in-the-loop workflow
 */

export class AgentManagerV2 {
  constructor(apiKey, mainWindow) {
    this.client = new Anthropic({ apiKey });
    this.mainWindow = mainWindow;
    this.agents = new Map(); // agentId -> agent state
    this.workspacesDir = path.join(os.homedir(), 'PersonalAssistant', 'agents', 'workspaces');

    // Ensure workspaces directory exists
    if (!fsSync.existsSync(this.workspacesDir)) {
      fsSync.mkdirSync(this.workspacesDir, { recursive: true });
    }
  }

  /**
   * Fetch and parse a web page to clean markdown
   */
  async fetchAndParsePage(url) {
    return new Promise((resolve, reject) => {
      // Validate URL
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          return reject(new Error('Only http:// and https:// URLs are supported'));
        }
      } catch (error) {
        return reject(new Error('Invalid URL format'));
      }

      // Choose http or https module
      const httpModule = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PersonalAssistantBot/1.0)'
        },
        timeout: 10000 // 10 second timeout
      };

      const req = httpModule.get(url, options, (res) => {
        // Handle redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          return this.fetchAndParsePage(res.headers.location).then(resolve).catch(reject);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }

        let data = '';
        let totalSize = 0;
        const maxSize = 2 * 1024 * 1024; // 2MB limit

        res.on('data', (chunk) => {
          totalSize += chunk.length;
          if (totalSize > maxSize) {
            req.destroy();
            return reject(new Error('Response too large (max 2MB)'));
          }
          data += chunk;
        });

        res.on('end', () => {
          try {
            // Simple HTML cleaning with regex
            let html = data;

            // Remove script and style tags with their content
            html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

            // Remove other unwanted tags
            html = html.replace(/<(nav|header|footer|iframe|noscript)[^>]*>.*?<\/\1>/gis, '');

            // Convert HTML to Markdown
            const turndownService = new TurndownService({
              headingStyle: 'atx',
              codeBlockStyle: 'fenced'
            });

            let markdown = turndownService.turndown(html);

            // Truncate to 50KB to avoid token limits
            const maxChars = 50 * 1024;
            if (markdown.length > maxChars) {
              markdown = markdown.substring(0, maxChars) + '\n\n[Content truncated - original page was longer]';
            }

            resolve({
              success: true,
              content: markdown,
              url: url,
              size: markdown.length
            });
          } catch (error) {
            reject(new Error(`Failed to parse HTML: ${error.message}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout (10 seconds)'));
      });

      req.on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });
    });
  }

  /**
   * Search the web using Brave Search API
   */
  async searchBrave(query, count = 5, settings) {
    // Check if web search is enabled
    if (!settings?.web_search_enabled || !settings?.brave_search_api_key) {
      return {
        success: false,
        error: 'Web search is disabled. To enable:\n' +
               '1. Get a free Brave Search API key from https://brave.com/search/api/\n' +
               '2. Add to ~/PersonalAssistant/config/settings.json:\n' +
               '   "brave_search_api_key": "BSA..."\n' +
               '   "web_search_enabled": true\n' +
               '3. Restart the app\n\n' +
               'Free tier: 2000 searches/month'
      };
    }

    return new Promise((resolve, reject) => {
      const apiKey = settings.brave_search_api_key;
      const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;

      const options = {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey
        },
        timeout: 10000
      };

      https.get(searchUrl, options, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Brave Search API error: HTTP ${res.statusCode}`));
        }

        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const result = JSON.parse(data);

            // Extract web results
            const webResults = result.web?.results || [];
            const formattedResults = webResults.map((r, index) => ({
              position: index + 1,
              title: r.title,
              url: r.url,
              description: r.description || ''
            }));

            resolve({
              success: true,
              query: query,
              results: formattedResults,
              count: formattedResults.length
            });
          } catch (error) {
            reject(new Error(`Failed to parse search results: ${error.message}`));
          }
        });
      }).on('error', (error) => {
        reject(new Error(`Brave Search API error: ${error.message}`));
      }).on('timeout', () => {
        reject(new Error('Brave Search API timeout (10 seconds)'));
      });
    });
  }

  /**
   * Tool definitions for the agent
   * These are the capabilities the agent can request
   */
  getToolDefinitions() {
    return [
      {
        name: 'write_file',
        description: 'Write content to a file in the agent workspace',
        input_schema: {
          type: 'object',
          properties: {
            filename: {
              type: 'string',
              description: 'Name of the file to write (e.g., "artifact.md")'
            },
            content: {
              type: 'string',
              description: 'Content to write to the file'
            }
          },
          required: ['filename', 'content']
        }
      },
      {
        name: 'read_file',
        description: 'Read content from a file in the agent workspace',
        input_schema: {
          type: 'object',
          properties: {
            filename: {
              type: 'string',
              description: 'Name of the file to read'
            }
          },
          required: ['filename']
        }
      },
      {
        name: 'list_files',
        description: 'List all files in the agent workspace',
        input_schema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'request_user_feedback',
        description: 'Ask the user a question or request feedback/clarification before proceeding. Use this when you need user input to make a decision or clarify requirements.',
        input_schema: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'The question to ask the user'
            },
            context: {
              type: 'string',
              description: 'Additional context about why this feedback is needed (optional)'
            }
          },
          required: ['question']
        }
      },
      {
        name: 'mark_complete',
        description: 'Mark the task as complete with optional review requirement',
        input_schema: {
          type: 'object',
          properties: {
            needs_review: {
              type: 'boolean',
              description: 'Whether the work needs human review before use'
            },
            summary: {
              type: 'string',
              description: 'Brief summary of what was accomplished'
            }
          },
          required: ['needs_review', 'summary']
        }
      },
      {
        name: 'fetch_url',
        description: 'Fetch and parse content from a web URL. Returns the page content converted to clean markdown format. Use this to read articles, documentation, or any web page content. Maximum content size: 50KB of text.',
        input_schema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL to fetch (must start with http:// or https://)'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'web_search',
        description: 'Search the web using Brave Search API. Returns a list of search results with titles, URLs, and descriptions. Use this to find information, research topics, or discover relevant resources. Then use fetch_url to read the full content of interesting results.',
        input_schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query (e.g., "latest AI trends 2025")'
            },
            count: {
              type: 'number',
              description: 'Number of results to return (1-10, default: 5)',
              minimum: 1,
              maximum: 10
            }
          },
          required: ['query']
        }
      },
      {
        name: 'read_task',
        description: 'Read a specific task by its ID. Returns full task details including all metadata and notes.',
        input_schema: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description: 'The unique ID of the task to read'
            }
          },
          required: ['task_id']
        }
      },
      {
        name: 'list_tasks',
        description: 'List tasks with optional filters. Use this to see what tasks exist, find tasks by priority or location, or get subtasks of a parent task.',
        input_schema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              enum: ['today', 'backlog', 'due_soon'],
              description: 'Filter by task location (optional)'
            },
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low', 'none'],
              description: 'Filter by priority (optional)'
            },
            has_deadline: {
              type: 'boolean',
              description: 'Only show tasks with deadlines (optional)'
            },
            parent_id: {
              type: 'string',
              description: 'Only show subtasks of this parent task (optional)'
            }
          }
        }
      },
      {
        name: 'create_task',
        description: 'Create a new task in the PersonalAssistant system. Tasks must have either a deadline (hard date) or target_date (soft goal). Use this to create follow-up tasks, break work into subtasks, or plan next steps.',
        input_schema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'The task title'
            },
            location: {
              type: 'string',
              enum: ['today', 'backlog', 'due_soon'],
              description: 'Where to create the task (default: backlog)'
            },
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low', 'none'],
              description: 'Task priority (optional)'
            },
            deadline: {
              type: 'string',
              description: 'Hard deadline in YYYY-MM-DD format (optional, but must have either deadline or target_date)'
            },
            target_date: {
              type: 'string',
              description: 'Soft target date in YYYY-MM-DD format (optional, but must have either deadline or target_date)'
            },
            notes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Initial notes for the task (optional)'
            },
            parent_id: {
              type: 'string',
              description: 'Parent task ID if this is a subtask (optional)'
            }
          },
          required: ['title']
        }
      },
      {
        name: 'update_task',
        description: 'Update an existing task. Can modify priority, deadline, target_date, title, and add notes. Notes are always appended (never replaced) to preserve history.',
        input_schema: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description: 'The unique ID of the task to update'
            },
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low', 'none'],
              description: 'New priority (optional)'
            },
            deadline: {
              type: 'string',
              description: 'New deadline in YYYY-MM-DD format or "none" (optional)'
            },
            target_date: {
              type: 'string',
              description: 'New target date in YYYY-MM-DD format or "none" (optional)'
            },
            title: {
              type: 'string',
              description: 'New title (optional)'
            },
            add_notes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Notes to append to the task (optional)'
            }
          },
          required: ['task_id']
        }
      },
      {
        name: 'mark_task_done',
        description: 'Mark a task as completed. The task will be moved to the archive with completion date. Use this when you or another agent has finished a task.',
        input_schema: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description: 'The unique ID of the task to mark as done'
            },
            completion_notes: {
              type: 'string',
              description: 'Optional notes about the completion (optional)'
            }
          },
          required: ['task_id']
        }
      },
      {
        name: 'delegate_task_to_agent',
        description: 'Delegate a task to a new agent. The new agent will work on the task independently, and when done, will attach output to the task. Use this to parallelize work by breaking down a task and delegating subtasks to other agents.',
        input_schema: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description: 'The unique ID of the task to delegate'
            },
            instructions: {
              type: 'string',
              description: 'Additional instructions or context for the new agent (optional)'
            }
          },
          required: ['task_id']
        }
      },
      {
        name: 'move_task',
        description: 'Move a task between lists (today, backlog, due_soon). Use this to adjust task priority or urgency based on findings or changing requirements.',
        input_schema: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description: 'The unique ID of the task to move'
            },
            destination: {
              type: 'string',
              enum: ['today', 'backlog', 'due_soon'],
              description: 'Where to move the task'
            }
          },
          required: ['task_id', 'destination']
        }
      },
      {
        name: 'attach_file_to_task',
        description: 'Attach a file from your workspace to a task. Use this to save your outputs (analysis documents, diagrams, reports, etc.) to a specific task for later reference.',
        input_schema: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description: 'The unique ID of the task to attach the file to'
            },
            source_file: {
              type: 'string',
              description: 'The filename of the file in your workspace to attach'
            },
            description: {
              type: 'string',
              description: 'Optional description of what the attachment contains'
            }
          },
          required: ['task_id', 'source_file']
        }
      },
      {
        name: 'get_task_attachments',
        description: 'Get attachments from a task and copy them to your workspace so you can access them. Use this when you need to view or work with files attached to a task (like screenshots, images, documents).',
        input_schema: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description: 'The unique ID of the task to get attachments from'
            }
          },
          required: ['task_id']
        }
      },
      {
        name: 'view_image',
        description: 'View and analyze an image file (PNG, JPG, etc.) from your workspace. This enables vision capabilities to describe what is in the image. The image will be included in the conversation for analysis.',
        input_schema: {
          type: 'object',
          properties: {
            filename: {
              type: 'string',
              description: 'The filename of the image in your workspace to view and analyze'
            },
            question: {
              type: 'string',
              description: 'Optional question or instruction about what to look for in the image'
            }
          },
          required: ['filename']
        }
      }
    ];
  }

  /**
   * Get default tool permissions (used when settings don't have tool_permissions configured)
   */
  getDefaultToolPermissions() {
    return {
      // File operations - safe, auto-approve
      write_file: 'auto',
      read_file: 'auto',
      list_files: 'auto',

      // Task read operations - safe, auto-approve
      read_task: 'auto',
      list_tasks: 'auto',

      // Attachment operations - safe, auto-approve
      get_task_attachments: 'auto',
      attach_file_to_task: 'auto',
      view_image: 'auto',

      // Task modifications - require approval by default
      create_task: 'approve',
      update_task: 'approve',
      mark_task_done: 'approve',
      move_task: 'approve',

      // User interaction - require approval
      request_user_feedback: 'approve',

      // Web operations - require approval
      web_search: 'approve',
      fetch_url: 'approve',

      // Agent operations - require approval
      delegate_task_to_agent: 'approve',

      // Completion - auto-approve
      mark_complete: 'auto'
    };
  }

  /**
   * Check if a tool needs approval based on settings
   */
  async toolNeedsApproval(toolName) {
    const settings = await this.loadSettings();
    const toolPermissions = settings.tool_permissions || this.getDefaultToolPermissions();

    // Default to 'approve' if tool not found in permissions
    const permission = toolPermissions[toolName] || 'approve';

    return permission === 'approve';
  }

  /**
   * Load settings from PersonalAssistant config
   */
  async loadSettings() {
    try {
      const settingsPath = path.join(os.homedir(), 'PersonalAssistant', 'config', 'settings.json');
      const settingsContent = await fs.readFile(settingsPath, 'utf-8');
      return JSON.parse(settingsContent);
    } catch (error) {
      console.error('Failed to load settings:', error);
      return {};
    }
  }

  /**
   * Load full task data from markdown files
   */
  async loadTaskData(taskId) {
    try {
      const paRoot = path.join(os.homedir(), 'PersonalAssistant');
      const taskFiles = [
        path.join(paRoot, 'tasks', 'today.md'),
        path.join(paRoot, 'tasks', 'due_soon.md'),
        path.join(paRoot, 'tasks', 'backlog.md')
      ];

      // Search through all task files
      for (const taskFile of taskFiles) {
        try {
          const content = await fs.readFile(taskFile, 'utf-8');
          const tasks = this.parseTasksFromMarkdown(content);
          const task = tasks.find(t => t.id === taskId);
          if (task) {
            return task;
          }
        } catch (error) {
          // File might not exist, continue to next
          continue;
        }
      }

      return null; // Task not found
    } catch (error) {
      console.error('Failed to load task data:', error);
      return null;
    }
  }

  /**
   * Parse tasks from markdown content
   */
  parseTasksFromMarkdown(content) {
    const tasks = [];
    const taskBlocks = content.split(/^## /m).slice(1); // Split by ## headers

    for (const block of taskBlocks) {
      const lines = block.trim().split('\n');
      const title = lines[0].trim();

      const task = {
        title,
        id: null,
        priority: 'none',
        deadline: 'none',
        target_date: 'none',
        notes: []
      };

      // Parse metadata
      for (const line of lines.slice(1)) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- id:')) {
          task.id = trimmed.replace('- id:', '').trim();
        } else if (trimmed.startsWith('- priority:')) {
          task.priority = trimmed.replace('- priority:', '').trim();
        } else if (trimmed.startsWith('- deadline:')) {
          task.deadline = trimmed.replace('- deadline:', '').trim();
        } else if (trimmed.startsWith('- target_date:')) {
          task.target_date = trimmed.replace('- target_date:', '').trim();
        } else if (trimmed.startsWith('- notes:')) {
          continue; // Notes header, actual notes come after
        } else if (trimmed.startsWith('  - ')) {
          // Note item (indented under notes)
          task.notes.push(trimmed.substring(4)); // Remove "  - " prefix
        }
      }

      if (task.id) {
        tasks.push(task);
      }
    }

    return tasks;
  }

  /**
   * List tasks with optional filters
   */
  async listTasks(filters = {}) {
    try {
      const paRoot = path.join(os.homedir(), 'PersonalAssistant');
      const locations = filters.location
        ? [filters.location]
        : ['today', 'backlog', 'due_soon'];

      const taskFiles = {
        'today': path.join(paRoot, 'tasks', 'today.md'),
        'backlog': path.join(paRoot, 'tasks', 'backlog.md'),
        'due_soon': path.join(paRoot, 'tasks', 'due_soon.md')
      };

      let allTasks = [];

      for (const location of locations) {
        try {
          const content = await fs.readFile(taskFiles[location], 'utf-8');
          const tasks = this.parseTasksFromMarkdown(content);

          // Add location to each task
          tasks.forEach(task => {
            task.location = location;
          });

          allTasks = allTasks.concat(tasks);
        } catch (error) {
          // File might not exist, continue
          continue;
        }
      }

      // Apply filters
      if (filters.priority) {
        allTasks = allTasks.filter(t => t.priority === filters.priority);
      }

      if (filters.has_deadline) {
        allTasks = allTasks.filter(t => t.deadline && t.deadline !== 'none');
      }

      if (filters.parent_id) {
        allTasks = allTasks.filter(t => t.parent_id === filters.parent_id);
      }

      // Return summary format
      return allTasks.map(task => ({
        id: task.id,
        title: task.title,
        location: task.location,
        priority: task.priority,
        deadline: task.deadline,
        target_date: task.target_date,
        parent_id: task.parent_id,
        subtasks: task.subtasks,
        notes_count: task.notes ? task.notes.length : 0
      }));
    } catch (error) {
      console.error('Failed to list tasks:', error);
      throw error;
    }
  }

  /**
   * Generate unique task ID from title
   */
  generateTaskId(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .trim()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .substring(0, 50); // Limit length
  }

  /**
   * Check if task ID exists across all task files
   */
  async taskIdExists(taskId) {
    const paRoot = path.join(os.homedir(), 'PersonalAssistant');
    const taskFiles = [
      path.join(paRoot, 'tasks', 'today.md'),
      path.join(paRoot, 'tasks', 'due_soon.md'),
      path.join(paRoot, 'tasks', 'backlog.md'),
      path.join(paRoot, 'archive', 'done.md'),
      path.join(paRoot, 'archive', 'dropped.md')
    ];

    for (const file of taskFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        if (content.includes(`- id: ${taskId}`)) {
          return true;
        }
      } catch (error) {
        continue;
      }
    }
    return false;
  }

  /**
   * Create a new task
   */
  async createTask(taskData, agentId = null) {
    try {
      const paRoot = path.join(os.homedir(), 'PersonalAssistant');

      // Generate unique ID
      let taskId = taskData.id || this.generateTaskId(taskData.title);
      let counter = 1;
      while (await this.taskIdExists(taskId)) {
        taskId = `${this.generateTaskId(taskData.title)}-${counter}`;
        counter++;
      }

      // Validate: must have either deadline or target_date
      const hasDeadline = taskData.deadline && taskData.deadline !== 'none';
      const hasTargetDate = taskData.target_date && taskData.target_date !== 'none';

      if (!hasDeadline && !hasTargetDate) {
        throw new Error('Task must have either a deadline or target_date (not both "none")');
      }

      // Determine location
      const location = taskData.location || 'backlog';
      const locationFile = {
        'today': path.join(paRoot, 'tasks', 'today.md'),
        'backlog': path.join(paRoot, 'tasks', 'backlog.md'),
        'due_soon': path.join(paRoot, 'tasks', 'due_soon.md')
      }[location];

      if (!locationFile) {
        throw new Error(`Invalid location: ${location}. Must be "today", "backlog", or "due_soon"`);
      }

      // Build task markdown
      const notesLines = (taskData.notes || []).map(note => `  - ${note}`).join('\n');
      const agentAttribution = agentId
        ? `  - [Created by Agent ${agentId} - ${new Date().toISOString().replace('T', ' ').substring(0, 19)}]`
        : '';

      const taskMarkdown = `
## ${taskData.title}
- id: ${taskId}
- parent_id: ${taskData.parent_id || 'none'}
- subtasks: ${taskData.subtasks || 'none'}
- status: open
- priority: ${taskData.priority || 'none'}
- deadline: ${taskData.deadline || 'none'}
- target_date: ${taskData.target_date || 'none'}
- days_in_today: ${location === 'today' ? 1 : 0}
- notes:
${agentAttribution}
${notesLines}
`;

      // Read existing file
      let content = await fs.readFile(locationFile, 'utf-8');

      // Append task to end of file
      content += '\n' + taskMarkdown;

      // Write back
      await fs.writeFile(locationFile, content, 'utf-8');

      // If task has parent_id, update parent's subtasks list
      if (taskData.parent_id && taskData.parent_id !== 'none') {
        await this.addSubtaskToParent(taskData.parent_id, taskId);
      }

      console.log(`[Agent ${agentId}] Created task: ${taskId} in ${location}`);

      return {
        id: taskId,
        title: taskData.title,
        location,
        priority: taskData.priority || 'none',
        deadline: taskData.deadline || 'none',
        target_date: taskData.target_date || 'none'
      };
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  }

  /**
   * Add subtask to parent's subtasks list
   */
  async addSubtaskToParent(parentId, subtaskId) {
    const paRoot = path.join(os.homedir(), 'PersonalAssistant');
    const taskFiles = [
      path.join(paRoot, 'tasks', 'today.md'),
      path.join(paRoot, 'tasks', 'due_soon.md'),
      path.join(paRoot, 'tasks', 'backlog.md')
    ];

    for (const taskFile of taskFiles) {
      try {
        let content = await fs.readFile(taskFile, 'utf-8');

        if (!content.includes(`- id: ${parentId}`)) {
          continue;
        }

        // Find the task block and update subtasks
        const taskBlocks = content.split(/^## /m);

        for (let i = 1; i < taskBlocks.length; i++) {
          const block = taskBlocks[i];
          if (block.includes(`- id: ${parentId}`)) {
            const lines = block.split('\n');

            for (let j = 0; j < lines.length; j++) {
              if (lines[j].trim().startsWith('- subtasks:')) {
                const currentSubtasks = lines[j].replace('- subtasks:', '').trim();
                const newSubtasks = currentSubtasks === 'none'
                  ? subtaskId
                  : `${currentSubtasks}, ${subtaskId}`;
                lines[j] = `- subtasks: ${newSubtasks}`;
                break;
              }
            }

            taskBlocks[i] = lines.join('\n');
            content = taskBlocks.join('## ');
            await fs.writeFile(taskFile, content, 'utf-8');
            return;
          }
        }
      } catch (error) {
        continue;
      }
    }
  }

  /**
   * Update an existing task
   */
  async updateTask(taskId, updates, agentId = null) {
    try {
      const paRoot = path.join(os.homedir(), 'PersonalAssistant');
      const taskFiles = [
        path.join(paRoot, 'tasks', 'today.md'),
        path.join(paRoot, 'tasks', 'due_soon.md'),
        path.join(paRoot, 'tasks', 'backlog.md')
      ];

      for (const taskFile of taskFiles) {
        try {
          let content = await fs.readFile(taskFile, 'utf-8');

          if (!content.includes(`- id: ${taskId}`)) {
            continue;
          }

          // Find the task block and update it
          const taskBlocks = content.split(/^## /m);
          let updated = false;

          for (let i = 1; i < taskBlocks.length; i++) {
            const block = taskBlocks[i];
            if (block.includes(`- id: ${taskId}`)) {
              const lines = block.split('\n');

              for (let j = 0; j < lines.length; j++) {
                const line = lines[j].trim();

                // Update priority
                if (updates.priority && line.startsWith('- priority:')) {
                  lines[j] = `- priority: ${updates.priority}`;
                }

                // Update deadline
                if (updates.deadline !== undefined && line.startsWith('- deadline:')) {
                  lines[j] = `- deadline: ${updates.deadline}`;
                }

                // Update target_date
                if (updates.target_date !== undefined && line.startsWith('- target_date:')) {
                  lines[j] = `- target_date: ${updates.target_date}`;
                }

                // Update title (first line of block)
                if (updates.title && j === 0) {
                  lines[j] = updates.title;
                }

                // Add notes (append to notes section)
                if (updates.add_notes && line === '- notes:') {
                  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
                  const agentAttribution = agentId
                    ? `[Added by Agent ${agentId} - ${timestamp}] `
                    : `[Updated - ${timestamp}] `;

                  // Find end of notes section
                  let notesEndIndex = j + 1;
                  while (notesEndIndex < lines.length && lines[notesEndIndex].trim().startsWith('  - ')) {
                    notesEndIndex++;
                  }

                  // Insert new notes
                  const newNotes = updates.add_notes.map(note =>
                    `  - ${agentAttribution}${note}`
                  );
                  lines.splice(notesEndIndex, 0, ...newNotes);
                  break; // Stop iterating after adding notes
                }
              }

              taskBlocks[i] = lines.join('\n');
              content = taskBlocks.join('## ');
              await fs.writeFile(taskFile, content, 'utf-8');
              updated = true;

              console.log(`[Agent ${agentId}] Updated task: ${taskId}`);
              return { success: true, task_id: taskId };
            }
          }

          if (updated) {
            return { success: true, task_id: taskId };
          }
        } catch (error) {
          continue;
        }
      }

      throw new Error(`Task ${taskId} not found`);
    } catch (error) {
      console.error('Failed to update task:', error);
      throw error;
    }
  }

  /**
   * Mark task as done (move to archive/done.md)
   */
  async markTaskDone(taskId, completionNotes = null, agentId = null) {
    try {
      const paRoot = path.join(os.homedir(), 'PersonalAssistant');
      const taskFiles = [
        path.join(paRoot, 'tasks', 'today.md'),
        path.join(paRoot, 'tasks', 'due_soon.md'),
        path.join(paRoot, 'tasks', 'backlog.md')
      ];
      const archiveFile = path.join(paRoot, 'archive', 'done.md');

      // Find and extract the task
      let taskBlock = null;
      let sourceFile = null;

      for (const taskFile of taskFiles) {
        try {
          let content = await fs.readFile(taskFile, 'utf-8');

          if (!content.includes(`- id: ${taskId}`)) {
            continue;
          }

          const taskBlocks = content.split(/^## /m);

          for (let i = 1; i < taskBlocks.length; i++) {
            if (taskBlocks[i].includes(`- id: ${taskId}`)) {
              taskBlock = taskBlocks[i];
              sourceFile = taskFile;

              // Remove task from source file
              taskBlocks.splice(i, 1);
              content = taskBlocks.join('## ');
              await fs.writeFile(taskFile, content, 'utf-8');
              break;
            }
          }

          if (taskBlock) break;
        } catch (error) {
          continue;
        }
      }

      if (!taskBlock) {
        throw new Error(`Task ${taskId} not found`);
      }

      // Modify task block: set status to completed, add completed_date, add completion notes
      const lines = taskBlock.split('\n');
      const today = new Date().toISOString().substring(0, 10); // YYYY-MM-DD

      for (let j = 0; j < lines.length; j++) {
        if (lines[j].trim().startsWith('- status:')) {
          lines[j] = '- status: completed';
        }

        if (lines[j].trim().startsWith('- days_in_today:')) {
          // Add completed_date field after days_in_today
          lines.splice(j + 1, 0, `- completed_date: ${today}`);
          break;
        }
      }

      // Add completion notes if provided
      if (completionNotes) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const attribution = agentId
          ? `[Completed by Agent ${agentId} - ${timestamp}]`
          : `[Completed - ${timestamp}]`;

        for (let j = 0; j < lines.length; j++) {
          if (lines[j].trim() === '- notes:') {
            let notesEndIndex = j + 1;
            while (notesEndIndex < lines.length && lines[notesEndIndex].trim().startsWith('  - ')) {
              notesEndIndex++;
            }
            lines.splice(notesEndIndex, 0, `  - ${attribution} ${completionNotes}`);
            break;
          }
        }
      }

      taskBlock = lines.join('\n');

      // Append to archive file
      let archiveContent = await fs.readFile(archiveFile, 'utf-8');
      archiveContent += '\n## ' + taskBlock;
      await fs.writeFile(archiveFile, archiveContent, 'utf-8');

      console.log(`[Agent ${agentId}] Marked task as done: ${taskId}`);
      return { success: true, task_id: taskId };
    } catch (error) {
      console.error('Failed to mark task done:', error);
      throw error;
    }
  }

  /**
   * Delegate a task to a new agent
   */
  async delegateTaskToAgent(taskId, instructions = '', agentId = null) {
    try {
      // Load task data
      const task = await this.loadTaskData(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      // Create task description for the new agent
      const taskDescription = instructions
        ? `${instructions}\n\nTask: ${task.title}`
        : `Work on: ${task.title}`;

      // Create new agent linked to this task
      const result = await this.createAgent(taskDescription, taskId);

      console.log(`[Agent ${agentId}] Delegated task ${taskId} to new agent ${result.agentId}`);

      return {
        success: true,
        agent_id: result.agentId,
        task_id: taskId
      };
    } catch (error) {
      console.error('Failed to delegate task to agent:', error);
      throw error;
    }
  }

  /**
   * Move a task between lists
   */
  async moveTask(taskId, destination, agentId = null) {
    try {
      const paRoot = path.join(os.homedir(), 'PersonalAssistant');
      const sourceFiles = [
        path.join(paRoot, 'tasks', 'today.md'),
        path.join(paRoot, 'tasks', 'due_soon.md'),
        path.join(paRoot, 'tasks', 'backlog.md')
      ];

      const destFiles = {
        'today': path.join(paRoot, 'tasks', 'today.md'),
        'backlog': path.join(paRoot, 'tasks', 'backlog.md'),
        'due_soon': path.join(paRoot, 'tasks', 'due_soon.md')
      };

      if (!destFiles[destination]) {
        throw new Error(`Invalid destination: ${destination}. Must be "today", "backlog", or "due_soon"`);
      }

      // Find and extract the task
      let taskBlock = null;
      let sourceFile = null;

      for (const file of sourceFiles) {
        try {
          let content = await fs.readFile(file, 'utf-8');

          if (!content.includes(`- id: ${taskId}`)) {
            continue;
          }

          const taskBlocks = content.split(/^## /m);

          for (let i = 1; i < taskBlocks.length; i++) {
            if (taskBlocks[i].includes(`- id: ${taskId}`)) {
              taskBlock = taskBlocks[i];
              sourceFile = file;

              // Remove task from source file (if different from destination)
              if (file !== destFiles[destination]) {
                taskBlocks.splice(i, 1);
                content = taskBlocks.join('## ');
                await fs.writeFile(file, content, 'utf-8');
              } else {
                // Task is already in the destination
                return { success: true, task_id: taskId, message: 'Task is already in the destination location' };
              }
              break;
            }
          }

          if (taskBlock) break;
        } catch (error) {
          continue;
        }
      }

      if (!taskBlock) {
        throw new Error(`Task ${taskId} not found`);
      }

      // Update days_in_today if moving to/from today
      const lines = taskBlock.split('\n');
      for (let j = 0; j < lines.length; j++) {
        if (lines[j].trim().startsWith('- days_in_today:')) {
          if (destination === 'today') {
            lines[j] = '- days_in_today: 1';
          } else {
            lines[j] = '- days_in_today: 0';
          }
          break;
        }
      }

      taskBlock = lines.join('\n');

      // Append to destination file
      let destContent = await fs.readFile(destFiles[destination], 'utf-8');
      destContent += '\n## ' + taskBlock;
      await fs.writeFile(destFiles[destination], destContent, 'utf-8');

      console.log(`[Agent ${agentId}] Moved task ${taskId} to ${destination}`);
      return { success: true, task_id: taskId, destination };
    } catch (error) {
      console.error('Failed to move task:', error);
      throw error;
    }
  }

  /**
   * Attach a file from agent workspace to a task
   */
  async attachFileToTask(taskId, sourceFile, description = null, agentId = null) {
    try {
      const paRoot = path.join(os.homedir(), 'PersonalAssistant');

      // Get the agent's workspace directory
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const sourceFilePath = path.join(agent.workspaceDir, sourceFile);

      // Check if source file exists
      try {
        await fs.access(sourceFilePath);
      } catch {
        throw new Error(`File not found in workspace: ${sourceFile}`);
      }

      // Create attachment directory for this task
      const attachmentDir = path.join(paRoot, 'attachments', taskId);
      await fs.mkdir(attachmentDir, { recursive: true });

      // Copy file to attachments directory
      const destFilePath = path.join(attachmentDir, sourceFile);
      await fs.copyFile(sourceFilePath, destFilePath);

      // Update task metadata to include the attachment
      const taskFiles = [
        path.join(paRoot, 'tasks', 'today.md'),
        path.join(paRoot, 'tasks', 'due_soon.md'),
        path.join(paRoot, 'tasks', 'backlog.md')
      ];

      for (const file of taskFiles) {
        try {
          let content = await fs.readFile(file, 'utf-8');

          if (!content.includes(`- id: ${taskId}`)) {
            continue;
          }

          const taskBlocks = content.split(/^## /m);

          for (let i = 1; i < taskBlocks.length; i++) {
            if (taskBlocks[i].includes(`- id: ${taskId}`)) {
              const lines = taskBlocks[i].split('\n');

              // Find and update attachments field, or add it
              let attachmentsLineIndex = -1;
              for (let j = 0; j < lines.length; j++) {
                if (lines[j].startsWith('- attachments:')) {
                  attachmentsLineIndex = j;
                  break;
                }
              }

              if (attachmentsLineIndex !== -1) {
                // Append to existing attachments
                const currentAttachments = lines[attachmentsLineIndex].replace('- attachments:', '').trim();
                if (currentAttachments === 'none' || currentAttachments === '') {
                  lines[attachmentsLineIndex] = `- attachments: ${sourceFile}`;
                } else {
                  lines[attachmentsLineIndex] = `- attachments: ${currentAttachments}, ${sourceFile}`;
                }
              } else {
                // Add attachments field after days_in_today or target_date
                let insertIndex = -1;
                for (let j = 0; j < lines.length; j++) {
                  if (lines[j].startsWith('- days_in_today:') || lines[j].startsWith('- target_date:')) {
                    insertIndex = j + 1;
                    break;
                  }
                }
                if (insertIndex !== -1) {
                  lines.splice(insertIndex, 0, `- attachments: ${sourceFile}`);
                }
              }

              // Add note about the attachment
              let notesIndex = -1;
              for (let j = 0; j < lines.length; j++) {
                if (lines[j].startsWith('- notes:')) {
                  notesIndex = j;
                  break;
                }
              }

              const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
              const noteText = description
                ? `  - [Attached by Agent ${agentId} - ${timestamp}] ${sourceFile} - ${description}`
                : `  - [Attached by Agent ${agentId} - ${timestamp}] ${sourceFile}`;

              if (notesIndex !== -1) {
                lines.splice(notesIndex + 1, 0, noteText);
              } else {
                // Add notes section if it doesn't exist
                lines.push('- notes:');
                lines.push(noteText);
              }

              taskBlocks[i] = lines.join('\n');
              content = taskBlocks.join('## ');
              await fs.writeFile(file, content, 'utf-8');

              console.log(`[Agent ${agentId}] Attached file ${sourceFile} to task ${taskId}`);
              return { success: true, task_id: taskId, filename: sourceFile };
            }
          }
        } catch (error) {
          // File might not exist, continue to next
          continue;
        }
      }

      throw new Error(`Task not found: ${taskId}`);
    } catch (error) {
      console.error('Failed to attach file to task:', error);
      throw error;
    }
  }

  /**
   * Get task attachments and copy them to agent workspace
   */
  async getTaskAttachments(taskId, agentId) {
    try {
      const paRoot = path.join(os.homedir(), 'PersonalAssistant');
      const attachmentDir = path.join(paRoot, 'attachments', taskId);

      // Get the agent's workspace directory
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      // Check if attachment directory exists
      try {
        await fs.access(attachmentDir);
      } catch {
        return { success: true, attachments: [] }; // No attachments
      }

      // List all files in the attachment directory
      const files = await fs.readdir(attachmentDir);

      // Copy each file to the agent's workspace
      const copiedFiles = [];
      for (const filename of files) {
        const sourcePath = path.join(attachmentDir, filename);
        const destPath = path.join(agent.workspaceDir, filename);
        await fs.copyFile(sourcePath, destPath);
        copiedFiles.push(filename);
      }

      console.log(`[Agent ${agentId}] Copied ${copiedFiles.length} attachments to workspace`);
      return { success: true, attachments: copiedFiles };
    } catch (error) {
      console.error('Failed to get task attachments:', error);
      throw error;
    }
  }

  /**
   * View an image file and prepare it for vision analysis
   */
  async viewImage(filename, question, agentId) {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const imagePath = path.join(agent.workspaceDir, filename);

      // Check if file exists
      try {
        await fs.access(imagePath);
      } catch {
        throw new Error(`Image file not found in workspace: ${filename}`);
      }

      // Read the image file and convert to base64
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Determine media type from extension
      const ext = filename.split('.').pop().toLowerCase();
      const mediaTypeMap = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp'
      };
      const mediaType = mediaTypeMap[ext] || 'image/png';

      const imageData = {
        filename,
        mediaType,
        base64: base64Image
      };

      // Store for next message
      agent.pendingImage = imageData;

      const message = question
        ? `Image "${filename}" loaded. Analyzing with focus on: ${question}`
        : `Image "${filename}" loaded and ready for analysis.`;

      console.log(`[Agent ${agentId}] Loaded image ${filename} (${mediaType})`);
      return { success: true, message, imageData };
    } catch (error) {
      console.error('Failed to view image:', error);
      throw error;
    }
  }

  /**
   * Attach agent artifact to a task's notes
   */
  async attachArtifactToTask(taskId, artifactPath, agentId) {
    try {
      const paRoot = path.join(os.homedir(), 'PersonalAssistant');
      const taskFiles = [
        path.join(paRoot, 'tasks', 'today.md'),
        path.join(paRoot, 'tasks', 'due_soon.md'),
        path.join(paRoot, 'tasks', 'backlog.md')
      ];

      // Find which file contains the task
      for (const taskFile of taskFiles) {
        try {
          let content = await fs.readFile(taskFile, 'utf-8');

          // Check if this file contains the task
          if (!content.includes(`- id: ${taskId}`)) {
            continue;
          }

          // Read artifact content
          const artifactContent = await fs.readFile(artifactPath, 'utf-8');
          const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

          // Create note with artifact reference
          const artifactNote = `[Agent Output - ${timestamp}]\\n${artifactContent}`;

          // Find the task block and add the note
          const taskBlocks = content.split(/^## /m);
          let updated = false;

          for (let i = 1; i < taskBlocks.length; i++) {
            const block = taskBlocks[i];
            if (block.includes(`- id: ${taskId}`)) {
              const lines = block.split('\n');
              let notesIndex = -1;

              // Find the notes section
              for (let j = 0; j < lines.length; j++) {
                if (lines[j].trim() === '- notes:') {
                  notesIndex = j;
                  break;
                }
              }

              if (notesIndex >= 0) {
                // Insert after existing notes
                let insertIndex = notesIndex + 1;
                while (insertIndex < lines.length && lines[insertIndex].trim().startsWith('  - ')) {
                  insertIndex++;
                }
                lines.splice(insertIndex, 0, `  - ${artifactNote}`);
              } else {
                // Add notes section if it doesn't exist
                lines.splice(lines.length - 1, 0, '- notes:', `  - ${artifactNote}`);
              }

              taskBlocks[i] = lines.join('\n');
              updated = true;
              break;
            }
          }

          if (updated) {
            // Reconstruct file content
            const newContent = taskBlocks.join('## ');
            await fs.writeFile(taskFile, newContent, 'utf-8');
            console.log(`[Agent ${agentId}] Attached artifact to task ${taskId} in ${taskFile}`);
            return { success: true };
          }
        } catch (error) {
          continue;
        }
      }

      console.error(`[Agent ${agentId}] Task ${taskId} not found in any task file`);
      return { success: false, error: 'Task not found' };
    } catch (error) {
      console.error(`[Agent ${agentId}] Failed to attach artifact:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute a tool call
   */
  async executeTool(agentId, toolName, toolInput) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    console.log(`[Agent ${agentId}] Executing tool: ${toolName}`, toolInput);

    // Log activity start
    const activityId = `${toolName}-${Date.now()}`;
    const startTime = Date.now();
    const activityEntry = {
      id: activityId,
      timestamp: new Date().toISOString(),
      tool: toolName,
      input: toolInput,
      status: 'executing',
      model: agent.lastModelUsed || 'unknown',
      result: null,
      error: null,
      duration: null
    };
    agent.activityLog.push(activityEntry);
    this.notifyAgentStateChange(agentId);

    let result;
    try {
      result = await this._executeToolInternal(agentId, toolName, toolInput);

      // Log activity success
      const duration = Date.now() - startTime;
      activityEntry.status = 'success';
      activityEntry.result = result;
      activityEntry.duration = duration;
      this.notifyAgentStateChange(agentId);

      return result;
    } catch (error) {
      // Log activity error
      const duration = Date.now() - startTime;
      activityEntry.status = 'error';
      activityEntry.error = error.message;
      activityEntry.duration = duration;
      this.notifyAgentStateChange(agentId);

      throw error;
    }
  }

  async _executeToolInternal(agentId, toolName, toolInput) {
    const agent = this.agents.get(agentId);

    switch (toolName) {
      case 'write_file': {
        const filePath = path.join(agent.workspaceDir, toolInput.filename);
        await fs.writeFile(filePath, toolInput.content, 'utf-8');

        // Track created file
        if (!agent.createdFiles) agent.createdFiles = [];
        if (!agent.createdFiles.includes(toolInput.filename)) {
          agent.createdFiles.push(toolInput.filename);
        }
        agent.primaryArtifact = toolInput.filename; // Last written file is primary

        console.log(`[Agent ${agentId}] Wrote file: ${toolInput.filename}, primary artifact now: ${agent.primaryArtifact}`);

        return { success: true, message: `File ${toolInput.filename} written successfully` };
      }

      case 'read_file': {
        const filePath = path.join(agent.workspaceDir, toolInput.filename);
        const content = await fs.readFile(filePath, 'utf-8');
        return { success: true, content };
      }

      case 'list_files': {
        const files = await fs.readdir(agent.workspaceDir);
        return { success: true, files };
      }

      case 'request_user_feedback': {
        agent.state = 'waiting_for_user_feedback';
        agent.pendingQuestion = {
          question: toolInput.question,
          context: toolInput.context || null
        };
        this.notifyAgentStateChange(agentId);
        this.notifyUserFeedbackNeeded(agentId, toolInput.question, toolInput.context);
        return { success: true, message: 'Waiting for user feedback' };
      }

      case 'mark_complete': {
        agent.state = toolInput.needs_review ? 'waiting_for_completion_review' : 'completed';
        agent.completionSummary = toolInput.summary;
        this.notifyAgentStateChange(agentId);
        return { success: true, message: 'Task marked as complete' };
      }

      case 'fetch_url': {
        try {
          console.log(`[Agent ${agentId}] Fetching URL: ${toolInput.url}`);
          const result = await this.fetchAndParsePage(toolInput.url);
          console.log(`[Agent ${agentId}] Successfully fetched ${result.size} characters from ${toolInput.url}`);
          return {
            success: true,
            content: result.content,
            url: result.url,
            size: result.size,
            message: `Fetched ${result.size} characters of content`
          };
        } catch (error) {
          console.error(`[Agent ${agentId}] Failed to fetch URL:`, error.message);
          return {
            success: false,
            error: error.message
          };
        }
      }

      case 'web_search': {
        try {
          const settings = await this.loadSettings();
          const count = toolInput.count || 5;
          console.log(`[Agent ${agentId}] Searching web for: "${toolInput.query}" (count: ${count})`);

          const result = await this.searchBrave(toolInput.query, count, settings);

          if (!result.success) {
            // Feature disabled - return helpful error message
            console.log(`[Agent ${agentId}] Web search disabled`);
            return {
              success: false,
              error: result.error
            };
          }

          console.log(`[Agent ${agentId}] Found ${result.count} search results`);
          return {
            success: true,
            query: result.query,
            results: result.results,
            count: result.count,
            message: `Found ${result.count} results for "${result.query}"`
          };
        } catch (error) {
          console.error(`[Agent ${agentId}] Web search failed:`, error.message);
          return {
            success: false,
            error: error.message
          };
        }
      }

      case 'read_task': {
        try {
          console.log(`[Agent ${agentId}] Reading task: ${toolInput.task_id}`);
          const task = await this.loadTaskData(toolInput.task_id);
          if (!task) {
            return {
              success: false,
              error: `Task ${toolInput.task_id} not found`
            };
          }
          return {
            success: true,
            task: task
          };
        } catch (error) {
          console.error(`[Agent ${agentId}] Failed to read task:`, error.message);
          return {
            success: false,
            error: error.message
          };
        }
      }

      case 'list_tasks': {
        try {
          console.log(`[Agent ${agentId}] Listing tasks with filters:`, toolInput);
          const tasks = await this.listTasks(toolInput);
          return {
            success: true,
            tasks: tasks,
            count: tasks.length
          };
        } catch (error) {
          console.error(`[Agent ${agentId}] Failed to list tasks:`, error.message);
          return {
            success: false,
            error: error.message
          };
        }
      }

      case 'create_task': {
        try {
          console.log(`[Agent ${agentId}] Creating task: ${toolInput.title}`);
          const task = await this.createTask(toolInput, agentId);
          return {
            success: true,
            task: task,
            message: `Created task "${task.title}" with ID: ${task.id}`
          };
        } catch (error) {
          console.error(`[Agent ${agentId}] Failed to create task:`, error.message);
          return {
            success: false,
            error: error.message
          };
        }
      }

      case 'update_task': {
        try {
          console.log(`[Agent ${agentId}] Updating task: ${toolInput.task_id}`);
          const result = await this.updateTask(toolInput.task_id, toolInput, agentId);
          return {
            success: true,
            task_id: result.task_id,
            message: `Updated task ${result.task_id}`
          };
        } catch (error) {
          console.error(`[Agent ${agentId}] Failed to update task:`, error.message);
          return {
            success: false,
            error: error.message
          };
        }
      }

      case 'mark_task_done': {
        try {
          console.log(`[Agent ${agentId}] Marking task done: ${toolInput.task_id}`);
          const result = await this.markTaskDone(toolInput.task_id, toolInput.completion_notes, agentId);
          return {
            success: true,
            task_id: result.task_id,
            message: `Marked task ${result.task_id} as completed`
          };
        } catch (error) {
          console.error(`[Agent ${agentId}] Failed to mark task done:`, error.message);
          return {
            success: false,
            error: error.message
          };
        }
      }

      case 'delegate_task_to_agent': {
        try {
          console.log(`[Agent ${agentId}] Delegating task to new agent: ${toolInput.task_id}`);
          const result = await this.delegateTaskToAgent(toolInput.task_id, toolInput.instructions, agentId);
          return {
            success: true,
            agent_id: result.agent_id,
            task_id: result.task_id,
            message: `Delegated task ${result.task_id} to agent ${result.agent_id}`
          };
        } catch (error) {
          console.error(`[Agent ${agentId}] Failed to delegate task:`, error.message);
          return {
            success: false,
            error: error.message
          };
        }
      }

      case 'move_task': {
        try {
          console.log(`[Agent ${agentId}] Moving task ${toolInput.task_id} to ${toolInput.destination}`);
          const result = await this.moveTask(toolInput.task_id, toolInput.destination, agentId);
          return {
            success: true,
            task_id: result.task_id,
            destination: result.destination,
            message: `Moved task ${result.task_id} to ${result.destination}`
          };
        } catch (error) {
          console.error(`[Agent ${agentId}] Failed to move task:`, error.message);
          return {
            success: false,
            error: error.message
          };
        }
      }

      case 'attach_file_to_task': {
        try {
          console.log(`[Agent ${agentId}] Attaching file ${toolInput.source_file} to task ${toolInput.task_id}`);
          const result = await this.attachFileToTask(
            toolInput.task_id,
            toolInput.source_file,
            toolInput.description,
            agentId
          );
          return {
            success: true,
            task_id: result.task_id,
            filename: result.filename,
            message: `Attached ${result.filename} to task ${result.task_id}`
          };
        } catch (error) {
          console.error(`[Agent ${agentId}] Failed to attach file:`, error.message);
          return {
            success: false,
            error: error.message
          };
        }
      }

      case 'get_task_attachments': {
        try {
          console.log(`[Agent ${agentId}] Getting attachments for task ${toolInput.task_id}`);
          const result = await this.getTaskAttachments(toolInput.task_id, agentId);
          return {
            success: true,
            attachments: result.attachments,
            message: `Copied ${result.attachments.length} attachment(s) to your workspace: ${result.attachments.join(', ')}. Use view_image to analyze image files.`
          };
        } catch (error) {
          console.error(`[Agent ${agentId}] Failed to get attachments:`, error.message);
          return {
            success: false,
            error: error.message
          };
        }
      }

      case 'view_image': {
        try {
          console.log(`[Agent ${agentId}] Viewing image: ${toolInput.filename}`);
          const result = await this.viewImage(toolInput.filename, toolInput.question, agentId);
          return {
            success: true,
            message: result.message,
            _includeImageInNextMessage: result.imageData // Special flag to include image
          };
        } catch (error) {
          console.error(`[Agent ${agentId}] Failed to view image:`, error.message);
          return {
            success: false,
            error: error.message
          };
        }
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Create a new agent
   */
  async createAgent(task, linkedTaskId = null) {
    const agentId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const workspaceDir = path.join(this.workspacesDir, agentId);

    // Create workspace directory
    await fs.mkdir(workspaceDir, { recursive: true });

    const agent = {
      id: agentId,
      name: task.substring(0, 50),
      task,
      linkedTaskId,
      state: 'initializing', // initializing, working, waiting_for_tool_approval, waiting_for_user_feedback, waiting_for_completion_review, completed, failed
      conversation: [], // Claude API messages
      pendingToolUse: null, // Current tool waiting for approval
      pendingQuestion: null, // Current question waiting for user feedback
      workspaceDir,
      createdAt: new Date().toISOString(),
      artifact: null,
      completionSummary: null,
      createdFiles: [], // Track all files created by agent
      primaryArtifact: null, // Most recently written file
      activityLog: [] // Track all tool executions with timestamps, models, inputs, results
    };

    this.agents.set(agentId, agent);

    console.log(`[Agent ${agentId}] Created for task: ${task}`);

    // Start the agent
    await this.startAgent(agentId);

    return { success: true, agentId };
  }

  /**
   * Start the agent conversation
   */
  async startAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Load task context if linkedTaskId is provided
    let taskContext = '';
    let attachmentImages = [];

    if (agent.linkedTaskId) {
      const taskData = await this.loadTaskData(agent.linkedTaskId);
      if (taskData) {
        taskContext = `

Task Context (from linked task):
- Task ID: ${agent.linkedTaskId}
- Task Title: ${taskData.title}
- Priority: ${taskData.priority}
- Deadline: ${taskData.deadline}
- Target Date: ${taskData.target_date}
${taskData.notes && taskData.notes.length > 0 ? `- Notes:\n${taskData.notes.map(n => `  * ${n}`).join('\n')}` : ''}`;

        // Auto-load attachments if they exist
        if (taskData.attachments && taskData.attachments !== 'none') {
          try {
            console.log(`[Agent ${agentId}] Auto-loading task attachments...`);
            const attachmentResult = await this.getTaskAttachments(agent.linkedTaskId, agentId);

            if (attachmentResult.attachments && attachmentResult.attachments.length > 0) {
              taskContext += `\n- Attachments loaded: ${attachmentResult.attachments.join(', ')}`;

              // Auto-load images for immediate viewing
              for (const filename of attachmentResult.attachments) {
                const ext = filename.split('.').pop().toLowerCase();
                if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
                  try {
                    const imageData = await this.viewImage(filename, null, agentId);
                    attachmentImages.push({
                      type: 'image',
                      source: {
                        type: 'base64',
                        media_type: imageData.imageData.mediaType,
                        data: imageData.imageData.base64
                      }
                    });
                    taskContext += `\n  * ${filename} (image loaded for your analysis)`;
                    console.log(`[Agent ${agentId}] Auto-loaded image: ${filename}`);
                  } catch (error) {
                    console.error(`[Agent ${agentId}] Failed to load image ${filename}:`, error.message);
                  }
                }
              }
            }
          } catch (error) {
            console.error(`[Agent ${agentId}] Failed to load attachments:`, error.message);
          }
        }

        taskContext += `\n\nUse this context to complete the task. All available information has been loaded.`;
      }
    }

    // Initial system prompt
    const hasFullContext = agent.linkedTaskId && taskContext.includes('All available information has been loaded');

    const systemPrompt = `You are a focused AI assistant working on a specific task. You have access to tools for file operations.

Task: ${agent.task}${taskContext}

Important Instructions:
1. ${hasFullContext
    ? 'All task context has been loaded (notes, attachments, images). Review the provided information and begin work immediately unless something is genuinely unclear.'
    : 'FIRST, carefully analyze the task. If it\'s vague, ambiguous, or unclear in ANY way, use the request_user_feedback tool to ask clarifying questions BEFORE starting work'}
   ${hasFullContext ? '' : '- Ask about format preferences, length, tone, specific requirements, etc.\n   - It\'s better to ask too many questions than to make wrong assumptions\n   - Only proceed with creating content once you have clear, specific instructions\n'}
2. Use ONE tool at a time and wait for the result before requesting another tool

3. Use the write_file tool to create your output in a file called 'artifact.md'

4. Use the mark_complete tool when you're done to indicate whether the work needs review

5. You're working in an isolated workspace directory

6. Focus on completing the task efficiently${hasFullContext ? '' : ' AFTER you\'ve clarified all requirements'}`;

    // Initial user message with pre-loaded images if available
    const initialContent = [{
      type: 'text',
      text: 'Please begin working on the task. Create your output and use the mark_complete tool when finished.'
    }];

    // Include pre-loaded images in the initial message
    if (attachmentImages.length > 0) {
      initialContent.push(...attachmentImages);
      console.log(`[Agent ${agentId}] Including ${attachmentImages.length} pre-loaded image(s) in initial context`);
    }

    agent.conversation = [{
      role: 'user',
      content: initialContent
    }];

    agent.state = 'working';
    this.notifyAgentStateChange(agentId);

    // Send first message to Claude
    await this.continueConversation(agentId, systemPrompt);
  }

  /**
   * Select the appropriate model based on agent state and context
   * Returns either Haiku (fast, cheap) or Sonnet (powerful, expensive)
   */
  selectModel(agent) {
    // Model IDs (latest versions as of January 2025)
    const HAIKU = 'claude-haiku-4-5-20251001';
    const SONNET = 'claude-sonnet-4-5-20250929';

    // Always use Sonnet for first 2 turns (planning phase)
    if (agent.conversation.length <= 3) {  // User msg + assistant msg + user msg = 3
      console.log(`[Agent ${agent.id}] Using Sonnet for initial planning (turn ${agent.conversation.length})`);
      return SONNET;
    }

    // Check if there's a pending image - vision requires Sonnet
    if (agent.pendingImage) {
      console.log(`[Agent ${agent.id}] Using Sonnet for vision capabilities`);
      return SONNET;
    }

    // Check if last tool used requires Sonnet
    const lastToolUsed = agent.lastToolUsed;

    // Simple tools that can use Haiku
    const haikuTools = [
      'read_file',
      'write_file',
      'list_files',
      'read_task',
      'update_task',
      'mark_task_done',
      'move_task',
      'attach_file_to_task',
      'get_task_attachments',
      'mark_complete'
    ];

    // Complex tools that need Sonnet
    const sonnetTools = [
      'request_user_feedback',  // Requires nuanced communication
      'create_task',            // Requires generating IDs and context
      'web_search',             // Requires analyzing search results
      'fetch_url',              // Requires processing web content
      'list_tasks',             // May require complex filtering logic
      'delegate_task_to_agent', // Requires task breakdown reasoning
      'view_image'              // Requires vision capabilities
    ];

    if (lastToolUsed && haikuTools.includes(lastToolUsed)) {
      console.log(`[Agent ${agent.id}] Using Haiku for simple operation: ${lastToolUsed}`);
      return HAIKU;
    }

    if (lastToolUsed && sonnetTools.includes(lastToolUsed)) {
      console.log(`[Agent ${agent.id}] Using Sonnet for complex operation: ${lastToolUsed}`);
      return SONNET;
    }

    // Default to Haiku for execution phase (after planning)
    console.log(`[Agent ${agent.id}] Using Haiku for execution phase`);
    return HAIKU;
  }

  /**
   * Continue the conversation with Claude
   */
  async continueConversation(agentId, systemPrompt) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    try {
      // Select appropriate model based on agent context
      const selectedModel = this.selectModel(agent);
      agent.lastModelUsed = selectedModel; // Track for activity log

      console.log(`[Agent ${agentId}] Sending message to Claude using ${selectedModel}...`);

      const response = await this.client.messages.create({
        model: selectedModel,
        max_tokens: 4096,
        system: systemPrompt ||`You are a focused AI assistant. Use tools to complete your task.

Task: ${agent.task}`,
        messages: agent.conversation,
        tools: this.getToolDefinitions()
      });

      console.log(`[Agent ${agentId}] Response from Claude:`, {
        stop_reason: response.stop_reason,
        content_blocks: response.content.length
      });

      // Add assistant response to conversation
      agent.conversation.push({
        role: 'assistant',
        content: response.content
      });

      // Handle response based on stop_reason
      if (response.stop_reason === 'tool_use') {
        // Claude wants to use tool(s) - get all tool_use blocks
        const toolUses = response.content.filter(block => block.type === 'tool_use');

        if (toolUses.length > 0) {
          // Check if ANY tool needs approval
          const approvalChecks = await Promise.all(
            toolUses.map(async (tool) => ({
              tool,
              needsApproval: await this.toolNeedsApproval(tool.name)
            }))
          );

          const firstNeedingApproval = approvalChecks.find(check => check.needsApproval);

          if (firstNeedingApproval) {
            // At least one tool needs approval - pause and ask for ALL tools
            agent.state = 'waiting_for_tool_approval';
            agent.pendingToolUse = firstNeedingApproval.tool;

            console.log(`[Agent ${agentId}] Requesting approval for tool: ${firstNeedingApproval.tool.name} (${toolUses.length} tools total)`);

            this.notifyAgentStateChange(agentId);
            this.notifyToolApprovalNeeded(agentId, firstNeedingApproval.tool);

            // STOP HERE - wait for user approval
            return;
          } else {
            // ALL tools can be auto-executed
            console.log(`[Agent ${agentId}] Auto-executing ${toolUses.length} tool(s)`);

            // Execute all tools and collect results
            const toolResults = [];
            for (const toolUse of toolUses) {
              agent.lastToolUsed = toolUse.name;
              const result = await this.executeTool(agentId, toolUse.name, toolUse.input);
              toolResults.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: JSON.stringify(result)
              });
            }

            // Add all tool results to conversation
            agent.conversation.push({
              role: 'user',
              content: toolResults
            });

            // Clear pending state and continue
            agent.pendingToolUse = null;
            agent.state = 'working';
            this.notifyAgentStateChange(agentId);

            // Continue the conversation
            await this.continueConversation(agentId, systemPrompt);
            return;
          }
        }
      } else if (response.stop_reason === 'end_turn') {
        // Claude finished its turn - check if there's text output
        const textBlocks = response.content.filter(block => block.type === 'text');
        if (textBlocks.length > 0) {
          console.log(`[Agent ${agentId}] Conversation turn complete`);
          agent.lastResponse = textBlocks.map(b => b.text).join('\n');
        }
      }

    } catch (error) {
      console.error(`[Agent ${agentId}] Error:`, error);
      agent.state = 'failed';
      agent.error = error.message;
      this.notifyAgentStateChange(agentId);
    }
  }

  /**
   * Approve and execute a pending tool use
   */
  async approveTool(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent || !agent.pendingToolUse) {
      throw new Error(`No pending tool for agent ${agentId}`);
    }

    const { name, input, id } = agent.pendingToolUse;

    try {
      // Track the tool being used for model selection
      agent.lastToolUsed = name;

      // Execute the tool
      const result = await this.executeTool(agentId, name, input);

      // Prepare tool result content
      const toolResultContent = [{
        type: 'tool_result',
        tool_use_id: id,
        content: JSON.stringify(result)
      }];

      // If this was view_image and there's a pending image, include it
      if (name === 'view_image' && agent.pendingImage) {
        toolResultContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: agent.pendingImage.mediaType,
            data: agent.pendingImage.base64
          }
        });
        console.log(`[Agent ${agentId}] Including image in conversation: ${agent.pendingImage.filename}`);
        agent.pendingImage = null; // Clear after use
      }

      // Add tool result to conversation
      agent.conversation.push({
        role: 'user',
        content: toolResultContent
      });

      agent.pendingToolUse = null;

      // Special case: mark_complete sets final state, don't override it
      if (name === 'mark_complete') {
        // State was already set by executeTool to 'waiting_for_completion_review' or 'completed'
        console.log(`[Agent ${agentId}] Task marked complete, final state: ${agent.state}`);

        // Auto-attach artifact to linked task if available
        if (agent.linkedTaskId && agent.primaryArtifact) {
          const artifactPath = path.join(agent.workspaceDir, agent.primaryArtifact);
          console.log(`[Agent ${agentId}] Attempting to attach artifact ${agent.primaryArtifact} to task ${agent.linkedTaskId}`);

          try {
            await this.attachArtifactToTask(agent.linkedTaskId, artifactPath, agentId);
            console.log(`[Agent ${agentId}] Successfully attached artifact to task`);
          } catch (error) {
            console.error(`[Agent ${agentId}] Failed to attach artifact to task:`, error);
            // Don't fail the completion, just log the error
          }
        }

        this.notifyAgentStateChange(agentId);
        return { success: true };
      }

      // Special case: request_user_feedback sets waiting state, don't continue conversation
      if (name === 'request_user_feedback') {
        // State was already set to 'waiting_for_user_feedback'
        console.log(`[Agent ${agentId}] Waiting for user feedback on: ${input.question}`);
        this.notifyAgentStateChange(agentId);
        return { success: true };
      }

      // For other tools, continue the conversation
      agent.state = 'working';
      this.notifyAgentStateChange(agentId);

      // Continue conversation with tool result
      await this.continueConversation(agentId);

      return { success: true };
    } catch (error) {
      console.error(`[Agent ${agentId}] Tool execution failed:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reject a pending tool use
   */
  async rejectTool(agentId, reason) {
    const agent = this.agents.get(agentId);
    if (!agent || !agent.pendingToolUse) {
      throw new Error(`No pending tool for agent ${agentId}`);
    }

    const { id } = agent.pendingToolUse;

    // Add tool rejection to conversation
    agent.conversation.push({
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: id,
        content: JSON.stringify({
          success: false,
          error: `Tool use rejected by user: ${reason}`
        }),
        is_error: true
      }]
    });

    agent.pendingToolUse = null;
    agent.state = 'working';
    this.notifyAgentStateChange(agentId);

    // Continue conversation
    await this.continueConversation(agentId);

    return { success: true };
  }

  /**
   * Get all agents
   */
  getAllAgents() {
    return Array.from(this.agents.values()).map(agent => ({
      id: agent.id,
      name: agent.name,
      task: agent.task,
      linkedTaskId: agent.linkedTaskId,
      state: agent.state,
      createdAt: agent.createdAt,
      artifact: agent.artifact,
      pendingToolUse: agent.pendingToolUse,
      pendingQuestion: agent.pendingQuestion,
      completionSummary: agent.completionSummary,
      primaryArtifact: agent.primaryArtifact,
      createdFiles: agent.createdFiles || []
    }));
  }

  /**
   * Get agent details
   */
  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  /**
   * Provide feedback to an agent (can be called anytime)
   */
  async provideFeedback(agentId, feedbackText) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    console.log(`[Agent ${agentId}] Received user feedback: ${feedbackText.substring(0, 50)}...`);

    // Add user feedback as a message to the conversation
    agent.conversation.push({
      role: 'user',
      content: `User feedback: ${feedbackText}`
    });

    // Clear pending question if there was one
    if (agent.pendingQuestion) {
      agent.pendingQuestion = null;
    }

    // Set state to working and continue conversation
    agent.state = 'working';
    this.notifyAgentStateChange(agentId);

    // Continue conversation with the feedback
    await this.continueConversation(agentId);

    return { success: true };
  }

  /**
   * Terminate an agent
   */
  async terminateAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.state = 'terminated';
      this.notifyAgentStateChange(agentId);
      this.agents.delete(agentId);
      console.log(`[Agent ${agentId}] Terminated`);
      return { success: true };
    }
    return { success: false, error: 'Agent not found' };
  }

  /**
   * Notify UI of state change
   */
  notifyAgentStateChange(agentId) {
    const agent = this.agents.get(agentId);
    if (agent && this.mainWindow) {
      this.mainWindow.webContents.send('agent-status-changed', {
        agentId,
        state: agent.state
      });
    }
  }

  /**
   * Notify UI that tool approval is needed
   */
  notifyToolApprovalNeeded(agentId, toolUse) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('agent-needs-tool-approval', {
        agentId,
        tool: {
          name: toolUse.name,
          input: toolUse.input,
          id: toolUse.id
        }
      });
    }
  }

  /**
   * Notify UI that user feedback is needed
   */
  notifyUserFeedbackNeeded(agentId, question, context) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('agent-needs-user-feedback', {
        agentId,
        question,
        context
      });
    }
  }
}
