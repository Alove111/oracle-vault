const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const vaultFileName = "vault.ovault";

function getVaultPath() {
  return path.join(app.getPath("userData"), vaultFileName);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: "#000000",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "../dist/index.html"));
}

ipcMain.handle("vault:read", async () => {
  const vaultPath = getVaultPath();

  if (!fs.existsSync(vaultPath)) {
    return null;
  }

  return fs.readFileSync(vaultPath, "utf-8");
});

ipcMain.handle("vault:write", async (_, data) => {
  const vaultPath = getVaultPath();

  fs.mkdirSync(path.dirname(vaultPath), { recursive: true });
  fs.writeFileSync(vaultPath, data, "utf-8");

  return true;
});

ipcMain.handle("vault:export", async () => {
  const vaultPath = getVaultPath();

  if (!fs.existsSync(vaultPath)) {
    return { success: false, message: "No vault file found." };
  }

  const result = await dialog.showSaveDialog({
    title: "Export Oracle Vault Backup",
    defaultPath: "oracle-vault-backup.ovault",
    filters: [{ name: "Oracle Vault Backup", extensions: ["ovault"] }],
  });

  if (result.canceled || !result.filePath) {
    return { success: false, message: "Export cancelled." };
  }

  fs.copyFileSync(vaultPath, result.filePath);

  return { success: true, message: "Backup exported successfully." };
});

ipcMain.handle("vault:import", async () => {
  const result = await dialog.showOpenDialog({
    title: "Import Oracle Vault Backup",
    filters: [{ name: "Oracle Vault Backup", extensions: ["ovault"] }],
    properties: ["openFile"],
  });

  if (result.canceled || !result.filePaths[0]) {
    return { success: false, message: "Import cancelled." };
  }

  const importedData = fs.readFileSync(result.filePaths[0], "utf-8");
  const vaultPath = getVaultPath();

  fs.mkdirSync(path.dirname(vaultPath), { recursive: true });
  fs.writeFileSync(vaultPath, importedData, "utf-8");

  return { success: true, message: "Backup imported successfully. Restart app." };
});

app.whenReady().then(() => {
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});