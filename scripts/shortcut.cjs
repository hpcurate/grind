/* Writes the Start-menu shortcut to the packed exe, carrying GRIND's
   AppUserModelID — Windows only shows an unpackaged app's notifications when
   a Start-menu shortcut has the same id as the running app.
   Run: npm run shortcut   (after npm run pack) */
'use strict';
const { app, shell } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
  const exe = path.resolve(__dirname, '..', 'dist', 'GRIND-win32-x64', 'GRIND.exe');
  const lnk = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'GRIND.lnk');
  if (!fs.existsSync(exe)) { console.error('no packed exe — run npm run pack first'); app.exit(1); return; }
  const ok = shell.writeShortcutLink(lnk, fs.existsSync(lnk) ? 'replace' : 'create', {
    target: exe, cwd: path.dirname(exe), icon: exe, iconIndex: 0,
    description: 'GRIND — production, sound design and socials', appUserModelId: 'com.hugo.grind',
  });
  console.log(ok ? 'wrote ' + lnk : 'could not write the shortcut');
  app.exit(ok ? 0 : 1);
});
