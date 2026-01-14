# Auto-Update System for PersonalAssistant

## Overview

The PersonalAssistant app now includes an auto-update mechanism using `electron-updater`. This allows you to push updates without requiring users to manually download and reinstall the app.

## How It Works

1. **Update Check**: When the app launches (in production mode), it automatically checks for updates after 3 seconds
2. **Notification**: If an update is available, a notification appears in the bottom-right corner
3. **Download**: Users can click "Download" to download the update in the background
4. **Install**: Once downloaded, users can click "Restart Now" to install the update, or choose "Later" to install on next app quit

## Publishing Updates

### Prerequisites

1. **GitHub Repository**: Make sure your repo is set up:
   - Repository: `https://github.com/PPPartners/personalassistant`
   - The repo must be public OR you need a GitHub token for private repos

2. **GitHub Personal Access Token**:
   ```bash
   export PERSONALASSISTANT_GH_TOKEN="your_github_personal_access_token"
   ```

   Note: This token should be scoped to only the `personalassistant` repository with `repo` permissions.

### Building and Publishing

1. **Update version** in `package.json`:
   ```json
   {
     "version": "1.0.1"
   }
   ```

2. **Build and publish** the app:
   ```bash
   cd ui
   npm run electron:build -- --publish always
   ```

   This will:
   - Build the app
   - Create a GitHub Release
   - Upload the build artifacts
   - Generate update files (latest.yml, latest-mac.yml, etc.)

3. **Alternative: Draft Release**
   ```bash
   npm run electron:build -- --publish onTagOrDraft
   ```
   This creates a draft release that you can review before publishing.

### Testing Updates Locally

To test the update mechanism:

1. **Build a base version** (e.g., 1.0.0):
   ```bash
   npm run electron:build
   ```

2. **Install the built app** from `dist/PersonalAssistant-1.0.0.dmg` (or .exe on Windows)

3. **Increment version** to 1.0.1 in package.json

4. **Build and publish** the update:
   ```bash
   npm run electron:build -- --publish always
   ```

5. **Launch the installed app** - it should detect and download the update

## Update Files

After building, these files are used for updates:

- `latest-mac.yml` (macOS) or `latest.yml` (Windows/Linux)
- The actual installer files (.dmg, .exe, etc.)
- `*.blockmap` files (for differential updates - only downloads changed parts)

## Configuration

Update settings are in `package.json`:

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "PPPartners",
      "repo": "personalassistant"
    }
  }
}
```

## Customization

### Change Update Frequency

In `electron/main.js`, modify:

```javascript
setTimeout(() => {
  checkForUpdates();
}, 3000); // Change this delay
```

### Manual Update Check

Users can also manually check for updates by calling:
```javascript
window.electronAPI.checkForUpdates()
```

You could add a "Check for Updates" button in the app settings.

## Troubleshooting

### Updates not detecting

- Check that GitHub release exists and is published (not draft)
- Verify version in package.json is higher than installed version
- Check console logs for update errors
- Ensure `latest-mac.yml` (or `latest.yml`) is present in the release

### Download failures

- Check internet connection
- Verify GitHub release assets are public/accessible
- Check if PERSONALASSISTANT_GH_TOKEN is valid and has proper permissions

### App not restarting after update

- Make sure `autoUpdater.quitAndInstall()` is being called
- Check if any dialogs are blocking the quit

## Security

- Updates are cryptographically signed and verified
- electron-updater verifies signatures before installing
- Only installs updates from the configured GitHub repository

## Alternative Update Sources

You can also use other providers instead of GitHub:

- **S3**: AWS S3 bucket
- **Generic**: Any HTTP(S) server
- **Spaces**: DigitalOcean Spaces

See electron-updater docs for configuration details.

## Notes

- Updates only work in **production builds** (not in development mode)
- macOS may require code signing for updates to work smoothly
- Windows updates work without signing but may show security warnings
