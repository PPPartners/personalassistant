import React, { useState, useEffect } from 'react';

function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Only set up listeners if running in Electron
    if (!window.electronAPI) return;

    // Set up update event listeners
    window.electronAPI.onUpdateAvailable((info) => {
      console.log('Update available:', info);
      setUpdateAvailable(true);
      setUpdateInfo(info);
    });

    window.electronAPI.onUpdateDownloadProgress((progress) => {
      console.log('Download progress:', progress);
      setDownloadProgress(progress.percent);
    });

    window.electronAPI.onUpdateDownloaded((info) => {
      console.log('Update downloaded:', info);
      setDownloading(false);
      setUpdateDownloaded(true);
    });

    window.electronAPI.onUpdateError((error) => {
      console.error('Update error:', error);
      setError(error);
      setDownloading(false);
    });
  }, []);

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await window.electronAPI.downloadUpdate();
    } catch (err) {
      setError(err.message);
      setDownloading(false);
    }
  };

  const handleInstall = () => {
    window.electronAPI.installUpdate();
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
    setUpdateDownloaded(false);
    setError(null);
  };

  // Don't render anything if not in Electron or no update available
  if (!window.electronAPI || (!updateAvailable && !updateDownloaded && !error)) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96">
      {/* Update Available */}
      {updateAvailable && !updateDownloaded && (
        <div className="bg-white rounded-lg shadow-lg border border-primary-200 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-neutral-900">Update Available</h3>
              <p className="text-sm text-neutral-600 mt-1">
                Version {updateInfo?.version} is ready to download.
              </p>
              {downloading && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-neutral-600 mb-1">
                    <span>Downloading...</span>
                    <span>{Math.round(downloadProgress)}%</span>
                  </div>
                  <div className="w-full bg-neutral-200 rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-2 mt-3">
                {!downloading && (
                  <>
                    <button
                      onClick={handleDownload}
                      className="px-3 py-1.5 bg-primary-500 text-white text-sm rounded hover:bg-primary-600 transition-colors"
                    >
                      Download
                    </button>
                    <button
                      onClick={handleDismiss}
                      className="px-3 py-1.5 bg-neutral-200 text-neutral-700 text-sm rounded hover:bg-neutral-300 transition-colors"
                    >
                      Later
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Downloaded */}
      {updateDownloaded && (
        <div className="bg-white rounded-lg shadow-lg border border-green-200 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-neutral-900">Update Ready</h3>
              <p className="text-sm text-neutral-600 mt-1">
                Version {updateInfo?.version} has been downloaded. Restart to install.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleInstall}
                  className="px-3 py-1.5 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
                >
                  Restart Now
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-3 py-1.5 bg-neutral-200 text-neutral-700 text-sm rounded hover:bg-neutral-300 transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-white rounded-lg shadow-lg border border-red-200 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-neutral-900">Update Error</h3>
              <p className="text-sm text-neutral-600 mt-1">{error}</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleDismiss}
                  className="px-3 py-1.5 bg-neutral-200 text-neutral-700 text-sm rounded hover:bg-neutral-300 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UpdateNotification;
