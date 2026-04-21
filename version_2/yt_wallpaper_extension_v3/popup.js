const status = document.getElementById("status");
const listDiv = document.getElementById("wallpaperList");

function showStatus(msg) {
  status.textContent = msg;
  setTimeout(() => status.textContent = "", 2000);
}

function sendUpdate() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "update" });
  });
}

function renderList() {
  chrome.storage.local.get(["wallpapers", "currentIndex"], (data) => {
    const wallpapers = data.wallpapers || [];
    const currentIndex = data.currentIndex || 0;

    listDiv.innerHTML = "";

    const label = document.createElement("div");
    label.id = "currentLabel";
    label.textContent = "Current: " + (wallpapers[currentIndex]?.name || "None");
    listDiv.appendChild(label);

    wallpapers.forEach((w, index) => {
      const item = document.createElement("div");
      item.className = "item";
      if (index === currentIndex) item.classList.add("active");

      const nameSpan = document.createElement("span");
      nameSpan.textContent = w.name;
      nameSpan.onclick = () => {
        chrome.storage.local.set({ currentIndex: index }, () => {
          showStatus("Switched!");
          renderList();
          sendUpdate();
        });
      };

      const del = document.createElement("span");
      del.textContent = "✖";
      del.className = "deleteBtn";
      del.onclick = (e) => {
        e.stopPropagation();
        chrome.storage.local.get(["wallpapers", "currentIndex"], (data) => {
          let wallpapers = data.wallpapers || [];
          wallpapers.splice(index, 1);

          let newIndex = 0;
          if (wallpapers.length > 0) {
            newIndex = Math.min(data.currentIndex || 0, wallpapers.length - 1);
          }

          chrome.storage.local.set({ wallpapers, currentIndex: newIndex }, () => {
            showStatus("Deleted");
            renderList();
            sendUpdate();
          });
        });
      };

      item.appendChild(nameSpan);
      item.appendChild(del);
      listDiv.appendChild(item);
    });
  });
}

document.getElementById("add").onclick = () => {
  const name = document.getElementById("name").value.trim();
  const url = document.getElementById("url").value.trim();
  if (!name || !url) return showStatus("Enter name & URL");

  chrome.storage.local.get(["wallpapers"], (data) => {
    let wallpapers = data.wallpapers || [];
    if (wallpapers.some(w => w.name.toLowerCase() === name.toLowerCase())) {
      return showStatus("Name exists");
    }

    wallpapers.push({ name, url });

    chrome.storage.local.set({ wallpapers, currentIndex: wallpapers.length - 1 }, () => {
      showStatus("Added!");
      renderList();
      sendUpdate();
    });
  });
};

renderList();
