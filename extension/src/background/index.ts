/**
 * Background script — handles browser action click to toggle inspect mode.
 */

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'toggle-inspect' })
  }
})
