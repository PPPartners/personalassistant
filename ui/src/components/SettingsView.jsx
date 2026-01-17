import React, { useState, useEffect } from 'react';

function SettingsView() {
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [originalApiKey, setOriginalApiKey] = useState(''); // Store original key
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'success' | 'error'
  const [showKey, setShowKey] = useState(false);
  const [toolPermissions, setToolPermissions] = useState({});
  const [originalToolPermissions, setOriginalToolPermissions] = useState({});

  useEffect(() => {
    loadSettings();
  }, []);

  const maskApiKey = (key) => {
    if (!key || key.length < 13) return key;
    const start = key.substring(0, 7); // "sk-ant-"
    const end = key.substring(key.length - 6); // last 6 chars
    return `${start}...${end}`;
  };

  const getDefaultToolPermissions = () => ({
    write_file: 'auto',
    read_file: 'auto',
    list_files: 'auto',
    read_task: 'auto',
    list_tasks: 'auto',
    get_task_attachments: 'auto',
    attach_file_to_task: 'auto',
    view_image: 'auto',
    create_task: 'approve',
    update_task: 'approve',
    mark_task_done: 'approve',
    move_task: 'approve',
    request_user_feedback: 'approve',
    web_search: 'approve',
    fetch_url: 'approve',
    delegate_task_to_agent: 'approve',
    mark_complete: 'auto'
  });

  const loadSettings = async () => {
    try {
      const result = await window.electronAPI.readFile('config/settings.json');
      if (result.success) {
        const settings = JSON.parse(result.content);
        const apiKey = settings.anthropic_api_key || '';
        const permissions = settings.tool_permissions || getDefaultToolPermissions();

        setOriginalApiKey(apiKey);
        setAnthropicApiKey(apiKey);
        setOriginalToolPermissions(permissions);
        setToolPermissions(permissions);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to load settings:', error);
      setLoading(false);
    }
  };

  const hasApiKey = originalApiKey && originalApiKey.length > 0;
  const isKeyModified = anthropicApiKey !== originalApiKey;

  const handleToolPermissionChange = async (tool, value) => {
    const newPermissions = {...toolPermissions, [tool]: value};
    setToolPermissions(newPermissions);

    // Auto-save tool permissions
    try {
      const readResult = await window.electronAPI.readFile('config/settings.json');
      let settings = {};
      if (readResult.success) {
        settings = JSON.parse(readResult.content);
      }
      settings.tool_permissions = newPermissions;
      await window.electronAPI.writeFile('config/settings.json', JSON.stringify(settings, null, 2));
      setOriginalToolPermissions(newPermissions);
      console.log('Tool permissions auto-saved');
    } catch (error) {
      console.error('Failed to auto-save tool permissions:', error);
    }
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    console.log('Saving API key...');
    try {
      // Read current settings
      let settings = {};
      try {
        const readResult = await window.electronAPI.readFile('config/settings.json');
        if (readResult.success) {
          settings = JSON.parse(readResult.content);
          console.log('Existing settings loaded');
        }
      } catch (error) {
        // Settings file doesn't exist yet, start fresh
        console.log('Creating new settings file');
        settings = {};
      }

      // Update API key and tool permissions
      settings.anthropic_api_key = anthropicApiKey;
      settings.tool_permissions = toolPermissions;

      // Write back to file
      const result = await window.electronAPI.writeFile('config/settings.json', JSON.stringify(settings, null, 2));
      console.log('Write result:', result);

      if (result.success) {
        setSaveStatus('success');
        console.log('Settings saved successfully');

        // Update the original values to reflect the save
        setOriginalApiKey(anthropicApiKey);
        setOriginalToolPermissions(toolPermissions);

        // Show success message
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        throw new Error(result.error || 'Write failed');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-secondary">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-base">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-dark-border">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Settings</h2>
          <p className="text-sm text-text-tertiary mt-1">
            Configure your PersonalAssistant
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          {/* Agent Settings Section */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Agent Configuration</h3>

            {/* Anthropic API Key */}
            <div className="glass border border-dark-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-text-primary">
                  Anthropic API Key
                </label>
                {hasApiKey && (
                  <span className="flex items-center gap-1 text-xs text-success-500 bg-success-500/10 px-2 py-1 rounded">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    API Key Configured
                  </span>
                )}
              </div>
              <p className="text-xs text-text-tertiary mb-3">
                Required for AI agent functionality. Get your API key from{' '}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-400 hover:text-primary-300 underline"
                >
                  console.anthropic.com
                </a>
              </p>

              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={showKey ? anthropicApiKey : (anthropicApiKey ? maskApiKey(anthropicApiKey) : '')}
                  onChange={(e) => setAnthropicApiKey(e.target.value)}
                  placeholder={hasApiKey ? maskApiKey(originalApiKey) : "sk-ant-..."}
                  className="w-full px-3 py-2 pr-20 bg-dark-hover border border-dark-border rounded text-text-primary focus:outline-none focus:border-primary-500"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs text-text-secondary hover:text-text-primary"
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>

              {/* Info Box */}
              <div className="mt-4 bg-dark-hover border border-dark-border rounded p-3">
                <p className="text-xs text-text-secondary">
                  <span className="font-semibold text-text-primary">Privacy Note:</span> Your API key is stored locally in{' '}
                  <code className="bg-dark-base px-1 py-0.5 rounded text-primary-400">
                    ~/PersonalAssistant/config/settings.json
                  </code>{' '}
                  and never committed to version control. The key is only used to communicate with Anthropic's API for agent functionality.
                </p>
              </div>

              {/* Save Button */}
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saveStatus === 'saving' || !isKeyModified}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saveStatus === 'saving' ? 'Saving...' : (hasApiKey ? 'Update API Key' : 'Save API Key')}
                </button>

                {isKeyModified && saveStatus === null && (
                  <span className="text-sm text-warning-500">
                    Unsaved changes
                  </span>
                )}

                {saveStatus === 'success' && (
                  <span className="text-sm text-success-500 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved! Reloading...
                  </span>
                )}

                {saveStatus === 'error' && (
                  <span className="text-sm text-error-500">
                    Failed to save settings
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tool Permissions Section */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Agent Tool Permissions</h3>

            <div className="glass border border-dark-border rounded-lg p-6">
              <p className="text-sm text-text-tertiary mb-4">
                Control which tools agents can use automatically vs. which require your approval.
              </p>

              {/* Tool Groups */}
              <div className="space-y-6">
                {/* File Operations */}
                <div>
                  <h4 className="text-sm font-semibold text-text-primary mb-3">File Operations</h4>
                  <div className="space-y-2">
                    {['write_file', 'read_file', 'list_files'].map(tool => (
                      <div key={tool} className="flex items-center justify-between py-2 px-3 bg-dark-hover rounded">
                        <span className="text-sm text-text-secondary">{tool.replace(/_/g, ' ')}</span>
                        <select
                          value={toolPermissions[tool] || 'approve'}
                          onChange={(e) => handleToolPermissionChange(tool, e.target.value)}
                          className="bg-dark-base border border-dark-border rounded px-2 py-1 text-sm text-text-primary"
                        >
                          <option value="auto">Auto-execute</option>
                          <option value="approve">Require approval</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Task Operations */}
                <div>
                  <h4 className="text-sm font-semibold text-text-primary mb-3">Task Operations</h4>
                  <div className="space-y-2">
                    {['read_task', 'list_tasks', 'create_task', 'update_task', 'mark_task_done', 'move_task'].map(tool => (
                      <div key={tool} className="flex items-center justify-between py-2 px-3 bg-dark-hover rounded">
                        <span className="text-sm text-text-secondary">{tool.replace(/_/g, ' ')}</span>
                        <select
                          value={toolPermissions[tool] || 'approve'}
                          onChange={(e) => handleToolPermissionChange(tool, e.target.value)}
                          className="bg-dark-base border border-dark-border rounded px-2 py-1 text-sm text-text-primary"
                        >
                          <option value="auto">Auto-execute</option>
                          <option value="approve">Require approval</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Web & Research */}
                <div>
                  <h4 className="text-sm font-semibold text-text-primary mb-3">Web & Research</h4>
                  <div className="space-y-2">
                    {['web_search', 'fetch_url'].map(tool => (
                      <div key={tool} className="flex items-center justify-between py-2 px-3 bg-dark-hover rounded">
                        <span className="text-sm text-text-secondary">{tool.replace(/_/g, ' ')}</span>
                        <select
                          value={toolPermissions[tool] || 'approve'}
                          onChange={(e) => handleToolPermissionChange(tool, e.target.value)}
                          className="bg-dark-base border border-dark-border rounded px-2 py-1 text-sm text-text-primary"
                        >
                          <option value="auto">Auto-execute</option>
                          <option value="approve">Require approval</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Attachments */}
                <div>
                  <h4 className="text-sm font-semibold text-text-primary mb-3">Attachments & Media</h4>
                  <div className="space-y-2">
                    {['get_task_attachments', 'attach_file_to_task', 'view_image'].map(tool => (
                      <div key={tool} className="flex items-center justify-between py-2 px-3 bg-dark-hover rounded">
                        <span className="text-sm text-text-secondary">{tool.replace(/_/g, ' ')}</span>
                        <select
                          value={toolPermissions[tool] || 'approve'}
                          onChange={(e) => handleToolPermissionChange(tool, e.target.value)}
                          className="bg-dark-base border border-dark-border rounded px-2 py-1 text-sm text-text-primary"
                        >
                          <option value="auto">Auto-execute</option>
                          <option value="approve">Require approval</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Other */}
                <div>
                  <h4 className="text-sm font-semibold text-text-primary mb-3">Other Operations</h4>
                  <div className="space-y-2">
                    {['request_user_feedback', 'delegate_task_to_agent', 'mark_complete'].map(tool => (
                      <div key={tool} className="flex items-center justify-between py-2 px-3 bg-dark-hover rounded">
                        <span className="text-sm text-text-secondary">{tool.replace(/_/g, ' ')}</span>
                        <select
                          value={toolPermissions[tool] || 'approve'}
                          onChange={(e) => handleToolPermissionChange(tool, e.target.value)}
                          className="bg-dark-base border border-dark-border rounded px-2 py-1 text-sm text-text-primary"
                        >
                          <option value="auto">Auto-execute</option>
                          <option value="approve">Require approval</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsView;
