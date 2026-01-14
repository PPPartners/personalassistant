# Release Checklist

Use this checklist for every new release to ensure all files are properly created.

## Pre-Release

- [ ] Update `version` in `ui/package.json` (e.g., `1.0.2`)
- [ ] Commit and push version bump
  ```bash
  git add ui/package.json
  git commit -m "Bump version to 1.0.X"
  git push
  ```

## Build

- [ ] Run release build:
  ```bash
  cd ui
  npm run release
  ```

- [ ] Verify all files exist in `ui/dist/`:
  ```bash
  ls -lh dist/*.dmg dist/*.zip dist/latest-mac.yml
  ```

  **Required files:**
  - ✅ `PersonalAssistant-X.X.X-arm64.dmg`
  - ✅ `PersonalAssistant-X.X.X-arm64-mac.zip`
  - ✅ `latest-mac.yml` ⚠️ **CRITICAL**

## Upload to GitHub

- [ ] Go to: https://github.com/PPPartners/personalassistant/releases/new
- [ ] Tag: `vX.X.X` (e.g., `v1.0.2`)
- [ ] Title: `X.X.X` (e.g., `1.0.2`)
- [ ] Drag & drop files:
  - [ ] `.dmg` file
  - [ ] `.zip` file
  - [ ] `latest-mac.yml` file
- [ ] Add release notes (what's new)
- [ ] Click "Publish release"

## Verify

- [ ] Check release page has all 3 files
- [ ] Open installed app (older version)
- [ ] Verify update notification appears
- [ ] Test download and install process

## If latest-mac.yml is Missing

If you forgot to upload `latest-mac.yml`:

1. Find it in `ui/dist/latest-mac.yml`
2. Go to the release page
3. Click "Edit"
4. Drag & drop `latest-mac.yml`
5. Save

Without this file, auto-updates **will not work**!
