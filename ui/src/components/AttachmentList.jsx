import React, { useState, useEffect } from 'react';

function AttachmentList({ taskId, onAttachmentsChange }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAttachments();
  }, [taskId]);

  const loadAttachments = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.listTaskAttachments(taskId);
      if (result.success) {
        setAttachments(result.attachments || []);
      }
    } catch (error) {
      console.error('Failed to load attachments:', error);
    }
    setLoading(false);
  };

  const handleOpen = async (filename) => {
    try {
      await window.electronAPI.openAttachment(taskId, filename);
    } catch (error) {
      console.error('Failed to open attachment:', error);
    }
  };

  const handleDelete = async (filename) => {
    if (!confirm(`Delete attachment "${filename}"?`)) {
      return;
    }

    try {
      const result = await window.electronAPI.deleteAttachment(taskId, filename);
      if (result.success) {
        await loadAttachments();
        if (onAttachmentsChange) {
          onAttachmentsChange();
        }
      }
    } catch (error) {
      console.error('Failed to delete attachment:', error);
    }
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();

    // Image files
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
      return (
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }

    // Document files
    if (['pdf', 'doc', 'docx'].includes(ext)) {
      return (
        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }

    // Markdown files
    if (['md', 'markdown'].includes(ext)) {
      return (
        <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    }

    // Default file icon
    return (
      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="text-sm text-neutral-500">
        Loading attachments...
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <div className="text-sm text-neutral-500">
        No attachments
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.filename}
          className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {getFileIcon(attachment.filename)}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-neutral-800 truncate">
                {attachment.filename}
              </div>
              <div className="text-xs text-neutral-500">
                {formatFileSize(attachment.size)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpen(attachment.filename)}
              className="p-2 hover:bg-neutral-200 rounded transition-colors"
              title="Open file"
            >
              <svg className="w-4 h-4 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
            <button
              onClick={() => handleDelete(attachment.filename)}
              className="p-2 hover:bg-red-100 rounded transition-colors"
              title="Delete attachment"
            >
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default AttachmentList;
