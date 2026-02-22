import { upsertBookmarkFromTab } from '../shared/storage.js';
import { getTabPageMetadata } from '../shared/page-metadata.js';

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function openManager() {
  const managerUrl = chrome.runtime.getURL('src/manager/manager.html');
  await chrome.tabs.create({ url: managerUrl });
}

async function quickSaveCurrentTab() {
  const tab = await getActiveTab();
  if (!tab?.url) return;

  try {
    const metadata = await getTabPageMetadata(tab.id);
    await upsertBookmarkFromTab(tab, bookmarkPatchFromMetadata(tab, metadata));
  } catch {
    // Ignore unsupported pages (chrome://, extensions, etc).
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-stash') {
    await openManager();
  }

  if (command === 'quick-save-current-tab') {
    await quickSaveCurrentTab();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'stash-open-library',
      title: 'Open Stash',
      contexts: ['action'],
    });

    chrome.contextMenus.create({
      id: 'stash-save-link',
      title: 'Save link to Stash',
      contexts: ['link'],
    });

    chrome.contextMenus.create({
      id: 'stash-save-page',
      title: 'Save page to Stash',
      contexts: ['page'],
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'stash-open-library') {
    await openManager();
    return;
  }

  if (info.menuItemId === 'stash-save-link' && info.linkUrl) {
    try {
      await upsertBookmarkFromTab({
        url: info.linkUrl,
        title: info.selectionText || info.linkText || info.linkUrl,
      });
    } catch {
      // Ignore unsupported URL types.
    }
  }

  if (info.menuItemId === 'stash-save-page' && tab) {
    try {
      const metadata = await getTabPageMetadata(tab.id);
      await upsertBookmarkFromTab(tab, bookmarkPatchFromMetadata(tab, metadata));
    } catch {
      // Ignore unsupported URL types.
    }
  }
});

function bookmarkPatchFromMetadata(tab, metadata) {
  const patch = {};

  if (metadata.title) patch.title = metadata.title;
  if (metadata.description) patch.description = metadata.description;
  if (metadata.previewImage) patch.previewImage = metadata.previewImage;
  if (metadata.favicon) patch.favicon = metadata.favicon;
  if (!patch.favicon && tab?.favIconUrl) patch.favicon = tab.favIconUrl;

  return patch;
}
