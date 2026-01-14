import React, { useState } from 'react';

function NotesEditor({ notes, onChange }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState('');

  const handleEdit = (index) => {
    setEditingIndex(index);
    setEditValue(notes[index]);
  };

  const handleSaveEdit = () => {
    const updated = [...notes];
    updated[editingIndex] = editValue;
    onChange(updated);
    setEditingIndex(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  const handleDelete = (index) => {
    const updated = notes.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleAddNote = () => {
    if (newNote.trim()) {
      onChange([...notes, newNote.trim()]);
      setNewNote('');
      setIsAdding(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editingIndex !== null) {
        handleSaveEdit();
      } else if (isAdding) {
        handleAddNote();
      }
    } else if (e.key === 'Escape') {
      if (editingIndex !== null) {
        handleCancelEdit();
      } else if (isAdding) {
        setIsAdding(false);
        setNewNote('');
      }
    }
  };

  const filteredNotes = notes.filter(note => note && note.trim() !== '');

  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-neutral-600">Notes</span>
        <button
          onClick={() => setIsAdding(true)}
          className="text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1"
        >
          <span>+</span>
          <span>Add Note</span>
        </button>
      </div>

      <div className="space-y-2">
        {filteredNotes.length === 0 && !isAdding && (
          <p className="text-neutral-400 italic text-sm">No notes yet</p>
        )}

        {filteredNotes.map((note, index) => (
          <div key={index} className="group">
            {editingIndex === index ? (
              <div className="flex gap-2">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 px-3 py-2 border border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  rows={2}
                  autoFocus
                />
                <div className="flex flex-col gap-1">
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1 bg-primary-500 text-white rounded text-xs hover:bg-primary-600"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-1 bg-neutral-200 text-neutral-700 rounded text-xs hover:bg-neutral-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-2 rounded hover:bg-neutral-50">
                <span className="text-neutral-600 mt-0.5">•</span>
                <p className="flex-1 text-sm text-neutral-800">{note}</p>
                <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                  <button
                    onClick={() => handleEdit(index)}
                    className="text-primary-600 hover:text-primary-700 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(index)}
                    className="text-danger-600 hover:text-danger-700 text-xs"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {isAdding && (
          <div className="flex gap-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter note..."
              className="flex-1 px-3 py-2 border border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              rows={2}
              autoFocus
            />
            <div className="flex flex-col gap-1">
              <button
                onClick={handleAddNote}
                className="px-3 py-1 bg-primary-500 text-white rounded text-xs hover:bg-primary-600"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewNote('');
                }}
                className="px-3 py-1 bg-neutral-200 text-neutral-700 rounded text-xs hover:bg-neutral-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default NotesEditor;
