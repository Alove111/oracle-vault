const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("oracleVault", {
  readVault: () => ipcRenderer.invoke("vault:read"),
  writeVault: (data) => ipcRenderer.invoke("vault:write", data),
  exportVault: () => ipcRenderer.invoke("vault:export"),
  importVault: () => ipcRenderer.invoke("vault:import"),
});