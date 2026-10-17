/* The renderer's only door to main. Exposed as window.grindAPI — and never
   re-declared under that name in app.js: a contextBridge key is a
   non-configurable global, and `const grindAPI = …` in a classic script is a
   parse-time SyntaxError that kills the whole UI (FLOW lost an afternoon to it). */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('grindAPI', {
  state: () => ipcRenderer.invoke('state'),
  op: (op, payload) => ipcRenderer.invoke('op', op, payload),
  onState: cb => ipcRenderer.on('state', (_e, s) => cb(s)),
  onToast: cb => ipcRenderer.on('toast', (_e, m) => cb(m)),
  scan: () => ipcRenderer.invoke('scan'),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  makeFolder: p => ipcRenderer.invoke('folder:make', p),
  openPath: p => ipcRenderer.invoke('open-path', p),
  openUrl: u => ipcRenderer.invoke('open-url', u),
  copy: text => ipcRenderer.invoke('clip', text),
  saveToken: t => ipcRenderer.invoke('todoist:token', t),
  forgetToken: () => ipcRenderer.invoke('todoist:forget'),
  todoistSettings: p => ipcRenderer.invoke('todoist:settings', p),
  send: x => ipcRenderer.invoke('todoist:send', x),
  poll: () => ipcRenderer.invoke('todoist:poll'),
  refreshDesk: () => ipcRenderer.invoke('desk:refresh'),
  exportData: () => ipcRenderer.invoke('data:export'),
  openData: () => ipcRenderer.invoke('data:folder'),
  minimize: () => ipcRenderer.send('win:min'),
  toggleMax: () => ipcRenderer.send('win:max'),
  close: () => ipcRenderer.send('win:close'),
  onMaxed: cb => ipcRenderer.on('win:maxed', (_e, on) => cb(on)),
});
