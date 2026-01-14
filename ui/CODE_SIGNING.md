# Code Signing Setup for macOS

Auto-updates on macOS require proper code signing and notarization. Follow these steps to set up.

## Prerequisites

### 1. Apple Developer Account
- Sign up at https://developer.apple.com ($99/year)
- Enroll in the Apple Developer Program

### 2. Get Your Developer ID Certificate

1. Go to https://developer.apple.com/account/resources/certificates/list
2. Click "+" to create a new certificate
3. Select "Developer ID Application"
4. Follow prompts to create a Certificate Signing Request (CSR)
5. Download the certificate and double-click to install in Keychain

### 3. Find Your Team ID

1. Go to https://developer.apple.com/account
2. Look for "Team ID" in your account settings
3. Save this - you'll need it for notarization

## Environment Variables

Add these to your `~/.zshrc` (or `~/.bashrc`):

```bash
# Apple Developer credentials for code signing
export APPLE_ID="your.email@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
```

### Getting App-Specific Password

1. Go to https://appleid.apple.com
2. Sign in with your Apple ID
3. Under "Sign-In and Security" → "App-Specific Passwords"
4. Click "+" to generate a new password
5. Name it "PersonalAssistant Notarization"
6. Save the generated password (you can't see it again!)

## Building Signed Apps

Once configured, builds will automatically:
1. Sign the app with your Developer ID certificate
2. Notarize the app with Apple
3. Staple the notarization ticket

```bash
cd ui
npm run release
```

### First Build

The first time may take 5-10 minutes for notarization. Subsequent builds are faster.

## Troubleshooting

### "No identity found"

Check your certificate:
```bash
security find-identity -v -p codesigning
```

You should see "Developer ID Application: Your Name (XXXXXXXXXX)"

### Notarization Fails

- Verify APPLE_ID is correct
- Verify app-specific password is correct
- Verify APPLE_TEAM_ID matches your developer account

### Build Without Signing (Development)

To build without signing (won't support auto-updates):
1. Edit `package.json`
2. Set `"identity": null` in the `mac` section
3. Build normally

## Auto-Updates

With proper signing:
- ✅ Auto-updates work seamlessly
- ✅ macOS Gatekeeper trusts the app
- ✅ No security warnings

Without signing:
- ❌ Auto-updates fail with signature errors
- ❌ Users must download manually
- ⚠️ Security warnings on first launch
