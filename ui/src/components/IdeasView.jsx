import React, { useState } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';

function IdeasView({ ideas, onAdd, onEdit, onDelete, onPromote }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newIdeaText, setNewIdeaText] = useState('');
  const [newIdeaDetails, setNewIdeaDetails] = useState(['']);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editText, setEditText] = useState('');
  const [editDetails, setEditDetails] = useState([]);

  const handleAddIdea = async () => {
    if (!newIdeaText.trim()) return;

    const details = newIdeaDetails.filter(d => d.trim().length > 0);
    await onAdd(newIdeaText.trim(), details);

    // Reset form
    setNewIdeaText('');
    setNewIdeaDetails(['']);
    setIsAdding(false);
  };

  const handleStartEdit = (index, idea) => {
    setEditingIndex(index);
    setEditText(idea.text);
    setEditDetails([...idea.details, '']);
  };

  const handleSaveEdit = async (index) => {
    if (!editText.trim()) return;

    const details = editDetails.filter(d => d.trim().length > 0);
    await onEdit(index, editText.trim(), details);

    setEditingIndex(null);
    setEditText('');
    setEditDetails([]);
  };

  const handleDelete = async (index) => {
    if (confirm('Are you sure you want to delete this idea?')) {
      await onDelete(index);
    }
  };

  const addDetailField = (setter, currentDetails) => {
    setter([...currentDetails, '']);
  };

  const updateDetail = (setter, currentDetails, index, value) => {
    const newDetails = [...currentDetails];
    newDetails[index] = value;
    setter(newDetails);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-dark-base p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-text-primary flex items-center gap-2">
              <span>💡</span>
              Ideas
            </h2>
            <p className="text-text-secondary mt-1">
              {ideas.length} {ideas.length === 1 ? 'idea' : 'ideas'} in inbox
            </p>
          </div>
          {!isAdding && (
            <Button
              variant="primary"
              onClick={() => setIsAdding(true)}
            >
              <span className="text-lg">+</span>
              <span>New Idea</span>
            </Button>
          )}
        </div>

        {/* Add New Idea Form */}
        {isAdding && (
          <Card variant="elevated" className="mb-6 p-4 border-2 border-focus-500/50">
            <h3 className="font-semibold text-text-primary mb-3">New Idea</h3>
            <input
              type="text"
              value={newIdeaText}
              onChange={(e) => setNewIdeaText(e.target.value)}
              placeholder="Main idea..."
              className="w-full px-3 py-2 bg-dark-base border border-dark-border text-text-primary placeholder-text-tertiary rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-focus-500/50 focus:border-focus-500/50 transition-all"
              autoFocus
            />
            <div className="space-y-2 mb-3">
              {newIdeaDetails.map((detail, i) => (
                <input
                  key={i}
                  type="text"
                  value={detail}
                  onChange={(e) => updateDetail(setNewIdeaDetails, newIdeaDetails, i, e.target.value)}
                  placeholder={`Detail ${i + 1}...`}
                  className="w-full px-3 py-2 pl-8 bg-dark-base border border-dark-border text-text-primary placeholder-text-tertiary rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-focus-500/50 focus:border-focus-500/50 transition-all"
                />
              ))}
              <button
                onClick={() => addDetailField(setNewIdeaDetails, newIdeaDetails)}
                className="text-sm text-focus-400 hover:text-focus-300 flex items-center gap-1 transition-colors"
              >
                <span>+</span> Add detail
              </button>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsAdding(false);
                  setNewIdeaText('');
                  setNewIdeaDetails(['']);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleAddIdea}
              >
                Add Idea
              </Button>
            </div>
          </Card>
        )}

        {/* Ideas List */}
        {ideas.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">💡</div>
            <h3 className="text-xl font-semibold text-text-primary mb-2">No ideas yet</h3>
            <p className="text-text-tertiary">Click "New Idea" to capture your thoughts</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ideas.map((idea, index) => (
              <Card
                key={index}
                variant="default"
                className="hover:border-focus-500/30 transition-all"
              >
                {editingIndex === index ? (
                  /* Edit Mode */
                  <div className="p-4">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full px-3 py-2 bg-dark-base border border-dark-border text-text-primary rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-focus-500/50 focus:border-focus-500/50 font-semibold transition-all"
                    />
                    <div className="space-y-2 mb-3">
                      {editDetails.map((detail, i) => (
                        <input
                          key={i}
                          type="text"
                          value={detail}
                          onChange={(e) => updateDetail(setEditDetails, editDetails, i, e.target.value)}
                          placeholder={`Detail ${i + 1}...`}
                          className="w-full px-3 py-2 pl-8 bg-dark-base border border-dark-border text-text-primary placeholder-text-tertiary rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-focus-500/50 focus:border-focus-500/50 transition-all"
                        />
                      ))}
                      <button
                        onClick={() => addDetailField(setEditDetails, editDetails)}
                        className="text-sm text-focus-400 hover:text-focus-300 flex items-center gap-1 transition-colors"
                      >
                        <span>+</span> Add detail
                      </button>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingIndex(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleSaveEdit(index)}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <>
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">💡</span>
                            <h3 className="font-semibold text-text-primary">{idea.text}</h3>
                          </div>
                          {idea.details.length > 0 && expandedIndex !== index && (
                            <p className="text-sm text-text-tertiary mt-1 ml-7">
                              {idea.details.length} detail{idea.details.length !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                        <button
                          className="text-text-tertiary hover:text-text-secondary transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedIndex(expandedIndex === index ? null : index);
                          }}
                        >
                          {expandedIndex === index ? '▲' : '▼'}
                        </button>
                      </div>

                      {/* Expanded Details */}
                      {expandedIndex === index && idea.details.length > 0 && (
                        <div className="mt-3 ml-7 space-y-1">
                          {idea.details.map((detail, i) => (
                            <div key={i} className="text-sm text-text-secondary flex items-start gap-2">
                              <span className="text-focus-400 mt-0.5">•</span>
                              <span>{detail}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="px-4 pb-3 flex gap-2">
                      <button
                        onClick={() => handleStartEdit(index, idea)}
                        className="flex-1 py-2 px-3 text-sm font-medium text-text-secondary bg-dark-base/50 hover:bg-dark-base/70 border border-dark-border hover:border-text-tertiary/30 rounded-md transition-all"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(index)}
                        className="flex-1 py-2 px-3 text-sm font-medium text-danger-400 bg-danger-500/10 hover:bg-danger-500/20 border border-danger-500/30 hover:border-danger-400/50 rounded-md transition-all"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => onPromote(idea)}
                        className="flex-1 py-2 px-3 text-sm font-medium text-focus-400 bg-focus-500/10 hover:bg-focus-500/20 border border-focus-500/30 hover:border-focus-400/50 rounded-md transition-all"
                      >
                        → Task
                      </button>
                    </div>
                  </>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default IdeasView;
