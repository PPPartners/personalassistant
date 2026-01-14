import React, { useState } from 'react';
import { formatDeadline } from '../utils/dateUtils';

function DatePicker({ label, value, onChange, canClear = true }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value === 'none' ? '' : value);

  const handleSave = () => {
    onChange(editValue || 'none');
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value === 'none' ? '' : value);
    setIsEditing(false);
  };

  const handleClear = () => {
    setEditValue('');
    onChange('none');
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isEditing) {
    return (
      <div className="group flex items-center justify-between py-2">
        <span className="text-sm font-medium text-neutral-600 w-32">{label}</span>
        <div className="flex-1 flex items-center justify-between">
          <span className="text-neutral-800">
            {value === 'none' || !value ? (
              <span className="text-neutral-400 italic">Not set</span>
            ) : (
              formatDeadline(value)
            )}
          </span>
          <button
            onClick={() => setIsEditing(true)}
            className="opacity-0 group-hover:opacity-100 ml-2 text-primary-600 hover:text-primary-700 text-sm"
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium text-neutral-600 w-32">{label}</span>
      <div className="flex-1 flex items-center gap-2">
        <input
          type="date"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-3 py-1.5 border border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 [color-scheme:dark]"
          autoFocus
        />
        <button
          onClick={handleSave}
          className="px-3 py-1.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm"
        >
          Save
        </button>
        {canClear && (
          <button
            onClick={handleClear}
            className="px-3 py-1.5 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 text-sm"
          >
            Clear
          </button>
        )}
        <button
          onClick={handleCancel}
          className="px-3 py-1.5 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default DatePicker;
