
const ids = ["glass","shorts","recommend","comments"];

chrome.storage.local.get(ids, (data) => {
  ids.forEach(id => {
    document.getElementById(id).checked = data[id] || false;
  });
});

ids.forEach(id => {
  document.getElementById(id).onchange = (e) => {
    const value = e.target.checked;

    chrome.storage.local.set({ [id]: value });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length) return;
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "toggle",
        feature: id,
        value: value
      });
    });
  };
});
