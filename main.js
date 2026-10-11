const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let updateDownloaded = false;
const APP_DATA_KEY = 'AGWliOfflineChurchManager_v1';

function sendStatus(status, detail = '') {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updater:status', { status, detail, version: app.getVersion() });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360, height: 900, minWidth: 900, minHeight: 650,
    title: 'Assemblies of God, Wli — Offline Church Manager',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: true
    }
  });
  // IMPORTANT: load the bundled local page. Do not replace this with loadURL() or the Gatherwell website.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

function configureUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on('checking-for-update', () => sendStatus('checking', 'Checking the official update feed…'));
  autoUpdater.on('update-available', info => sendStatus('available', `Version ${info.version} found. Downloading automatically…`));
  autoUpdater.on('download-progress', p => sendStatus('downloading', `Downloading update: ${Math.round(p.percent)}%`));
  autoUpdater.on('update-downloaded', info => { updateDownloaded = true; sendStatus('downloaded', `Version ${info.version} is ready. Save a local backup and install when prompted.`); });
  autoUpdater.on('update-not-available', () => sendStatus('current', 'You are using the latest available version.'));
  autoUpdater.on('error', err => sendStatus('error', err && err.message ? err.message : 'Update check failed. You can continue using the app offline.'));
}

ipcMain.handle('updater:check', async () => {
  if (!app.isPackaged) return { status: 'development', message: 'Update checks work in the installed, packaged application.' };
  try { await autoUpdater.checkForUpdates(); return { status: 'started' }; }
  catch (e) { sendStatus('error', e.message); return { status: 'error', message: e.message }; }
});

ipcMain.handle('updater:install', async (_event, localStorageJson) => {
  if (!updateDownloaded) return { status: 'no-update' };
  try {
    // Save the current localStorage payload to a dated local backup before replacing the app.
    const backupDir = path.join(app.getPath('userData'), 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `AG-Wli-auto-backup-${stamp}.json`);
    let payload = {};
    try { payload = JSON.parse(localStorageJson || '{}'); } catch (_) {}
    // Keep the backup compatible with the app's normal Restore Backup function.
    payload.backupVersion = 1;
    payload.exportedAt = new Date().toISOString();
    payload.automaticBackupReason = 'Pre-update automatic backup';
    fs.writeFileSync(backupPath, JSON.stringify(payload, null, 2), 'utf8');
    sendStatus('installing', `Backup saved locally. Installing update…`);
    autoUpdater.quitAndInstall();
    return { status: 'installing', backupPath };
  } catch (e) {
    dialog.showErrorBox('Update not installed', `A backup could not be created, so the update was not started.\n\n${e.message}`);
    return { status: 'error', message: e.message };
  }
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  configureUpdater();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  // Check shortly after launch; the app still opens locally when there is no internet.
  setTimeout(() => { if (app.isPackaged) autoUpdater.checkForUpdates().catch(() => {}); }, 5000);
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
