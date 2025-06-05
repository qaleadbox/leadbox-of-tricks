// Get the extension version from manifest
const manifest = chrome.runtime.getManifest();
const currentVersion = manifest.version;
document.getElementById('version').textContent = `v${currentVersion}`;

function compareVersions(v1, v2) {
  const v1Parts = v1.split('.').map(Number);
  const v2Parts = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;
    
    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }
  return 0;
}

function extractVersionNumber(tagName) {
  const match = tagName.match(/v?(\d+\.\d+)/);
  return match ? match[1] : null;
}

async function checkForUpdates() {
  try {
    const response = await fetch('https://api.github.com/repos/robinsonmourao/Inventory-Crawl-Chrome-Extension/releases');
    const releases = await response.json();
    
    if (releases && releases.length > 0) {
      const latestRelease = releases[0];
      const latestVersion = extractVersionNumber(latestRelease.tag_name);
      
      if (latestVersion && compareVersions(latestVersion, currentVersion) > 0) {
        const versionSpan = document.getElementById('version');
        versionSpan.innerHTML = `v${currentVersion} <span style="color: #ff6b6b; font-size: 0.8em;">(Update available: v${latestVersion})</span>`;
        versionSpan.title = `Click to download v${latestVersion}`;
        versionSpan.style.cursor = 'pointer';
        versionSpan.onclick = () => {
          window.open(latestRelease.html_url, '_blank');
        };
      }
    }
  } catch (error) {
    console.error('Error checking for updates:', error);
  }
}

checkForUpdates(); 