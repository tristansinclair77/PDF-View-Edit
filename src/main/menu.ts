import { Menu, BrowserWindow, MenuItemConstructorOptions } from 'electron';

export function buildMenu(window: BrowserWindow): Menu {
  const sendAction = (action: string) => {
    window.webContents.send('menu-action', action);
  };

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'Open...', accelerator: 'CmdOrCtrl+O', click: () => sendAction('file-open') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendAction('file-save') },
        { label: 'Save As...', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendAction('file-save-as') },
        { type: 'separator' },
        { label: 'Export Flattened...', click: () => sendAction('export-flattened') },
        { type: 'separator' },
        { label: 'Print', accelerator: 'CmdOrCtrl+P', click: () => sendAction('print') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => sendAction('undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', click: () => sendAction('redo') },
        { type: 'separator' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', click: () => sendAction('copy') },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', click: () => sendAction('paste') },
        { label: 'Delete', accelerator: 'Delete', click: () => sendAction('delete') },
        { type: 'separator' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', click: () => sendAction('select-all') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: () => sendAction('zoom-in') },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => sendAction('zoom-out') },
        { label: 'Fit Width', click: () => sendAction('fit-width') },
        { label: 'Fit Page', click: () => sendAction('fit-page') },
        { type: 'separator' },
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+B', click: () => sendAction('toggle-sidebar') },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Tools',
      submenu: [
        { label: 'Select', accelerator: 'V', click: () => sendAction('tool-select') },
        { label: 'Edit Text', accelerator: 'T', click: () => sendAction('tool-edit-text') },
        { label: 'Insert Image', click: () => sendAction('tool-insert-image') },
        { label: 'Signature', click: () => sendAction('tool-signature') },
        { label: 'Redact', click: () => sendAction('tool-redact') },
        { type: 'separator' },
        { label: 'Line', accelerator: 'L', click: () => sendAction('tool-line') },
        { label: 'Arrow', click: () => sendAction('tool-arrow') },
        { label: 'Rectangle', accelerator: 'R', click: () => sendAction('tool-rect') },
        { label: 'Ellipse', accelerator: 'E', click: () => sendAction('tool-ellipse') },
        { label: 'Freehand', accelerator: 'P', click: () => sendAction('tool-freehand') },
        { label: 'Text Box', click: () => sendAction('tool-textbox') },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Keyboard Shortcuts', accelerator: 'CmdOrCtrl+/', click: () => sendAction('show-shortcuts') },
        { type: 'separator' },
        { label: 'About PDF View & Edit', click: () => sendAction('show-about') },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
