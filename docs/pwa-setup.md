# PWA Installation Guide

Dite POS is a Progressive Web App (PWA) that can be installed on desktop and mobile devices for offline use.

## Desktop Installation

### Chrome / Edge
1. Open Dite POS in Chrome or Edge
2. Look for the install icon in the address bar (⊕ or ↓)
3. Click **Install**
4. The app will be added to your desktop and start menu

### Firefox
1. Open Dite POS in Firefox
2. Click the menu (≡) > **Install** > **Dite POS**
3. Confirm the installation

## Mobile Installation

### Android (Chrome)
1. Open Dite POS in Chrome
2. Tap the menu (⋮) > **Add to Home screen**
3. Tap **Add**
4. The app icon will appear on your home screen

### iOS (Safari)
1. Open Dite POS in Safari
2. Tap the Share button (□↑)
3. Tap **Add to Home Screen**
4. Tap **Add**

## Offline Capability

Once installed, Dite POS works offline:

- **Product Catalog**: Cached locally for browsing
- **Sales Queue**: Transactions are saved locally when offline
- **Sync Engine**: Automatically syncs when connection returns
- **Customer Data**: Cached for quick selection

## Sync Behavior

| Status | Description |
|--------|-------------|
| 🟢 Online | All data synced with server |
| 🟡 Syncing | Uploading/downloading changes |
| 🔴 Offline | Using local data only |
| ⚠️ Conflict | Manual resolution required |

## Storage Usage

The PWA uses IndexedDB for local storage:
- Product catalog: ~5-10MB
- Sales queue: ~1MB per 100 transactions
- Customer cache: ~1MB

## Updating the App

- The PWA auto-updates when a new version is deployed
- Users will see an update notification
- Refresh the page to apply updates

## Uninstalling

### Desktop
- Chrome/Edge: Right-click the app icon > **Uninstall**
- Firefox: Menu > **Remove Dite POS**

### Mobile
- Long-press the app icon > **Remove** or **Uninstall**
