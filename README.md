# **How to install**
## Chrome
1. Open CHROME BROWSER.
2. Access `chrome://extensions/`.
3. Enable **Developer Mode**.
4. Click on **Load unpacked**.
5. Browse the Extension Location.

# **Structure**
## **Folders**
```
root/
├── manifest.json -> Main configuration file.
├── popup.html -> Interface HTML file.
├── popup.js -> JavaScript file.
├── background.js -> Background behaviour file 
├── readme.md -> **This** Markdown instructions file
├── icon.png -> Extension Icon. It will shown on browser's extension list
```

# Goal
May 17, 2024 | Inventory Crawl Function
Attendees: Agustín Gutiérrez Estevan Martins Legna Ettedgui

Notes
    • Task: https://3.basecamp.com/5126812/buckets/24988316/todos/7301107305
    • A frontend application that scans SRP pages for the following:
- Prices (or lack of prices)
- Pictures (or coming soon)
    • Local Extension
    • Saves the result to a Word document
    • View More button is a challenge
    • 100% Frontend (no backend, no JSON)
    • Use this page as a reference https://landrovertoronto.ca/used-vehicles/ and https://jaguartoronto.com/new-vehicles/ 

Action items
    • Research how the View More button works
    • Check if coming soon images have the same class as regular images
    • Make a list of what types of data the application will capture
    • Research how the infinite scroll works
