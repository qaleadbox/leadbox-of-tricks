# **How to install**

## Google Chrome

### Clonning project

`
git clone https://github.com/robinsonmourao/Inventory-Crawl-Chrome-Extension.git
`

### Environment API key

Create a file on the project's root "config.js" and inside of it
`
export const OPENAI_API_KEY = <your-openai-api-key-here>;
export const OPENAI_API_URL = <your-openai-link-here>;
`

### Installing by chrome packing

1. Open CHROME BROWSER.
2. Access `chrome://extensions/`.
3. Enable **Developer Mode**.
4. Click on **Load unpacked**.
5. Browse the Extension Location.

### .crx extension

1. Open CHROME BROWSER.
2. Access `chrome://extensions/`.
3. Enable **Developer Mode**.
4. Download **Inventory Crawl Chrome Extension.crx** file.
5. Drop file into Google Chrome extensions tab.

# Structure

## Folders

```
root/
├── extensions -> Browsers extensions folder.
    └── Google Chrome
        ├── Inventory Crawl Chrome Extension.crx -> Chrome extension
        └── Inventory Crawl Chrome Extension.pem - Chrome extension permission
├── icons -> Extension Icon's folder.
    ├── 16x16 -> 16x16 icons
    ├── 48x48 -> 48x48 icons
    └── 128x128 -> 128x128 icons
├── popup.html -> Interface HTML file.
├── check missing images.js -> Crawl coming soon images script.
├── match csv data with SRP cards information.js -> CSV-SRP Cards data comparisson script.
├── HREF extraction to spreadsheet.js -> HREF extrator script.
├── background.js -> Background behaviour file 
├── readme.md -> **This** Markdown instructions file
└── manifest.json -> Main configuration file.
```

# Development Status

| Action items       | Status        |
|--------------------|---------------|
| Local Extension                                                   | done |
| 100% Frontend (no backend, no JSON)                               | done |
| Research how the infinite scroll works                            | done |
| Saves the result to a CSV document                               | done |
| View More button is a challenge                                   | done |
| Implement the pagination by numbers                              | done |
| Make a list of what types of data the application will capture    | done |
| Compare .csv file with what's shown in the SRP                   | done |
| Check if coming soon images have the same class as regular images | pending |
| Use AI for the comparison                                       | pending |

# Known Issues

=> Once algoritm runned, if we refresh the page it will scoll down one time by it self.

# Goal

May 17, 2024 | Inventory Crawl Function
Attendees: Agustín Gutiérrez Estevan Martins Legna Ettedgui

Notes
    • Task: <https://3.basecamp.com/5126812/buckets/24988316/todos/7301107305>
    • A frontend application that scans SRP pages for the following:
        - Prices (or lack of prices)
        - Pictures (or coming soon)
    • Local Extension
    • Saves the result to a Word document
    • View More button is a challenge
    • 100% Frontend (no backend, no JSON)
    • Use this page as a reference <https://landrovertoronto.ca/used-vehicles/> and <https://jaguartoronto.com/new-vehicles/>

Action items
    • Research how the View More button works
    • Check if coming soon images have the same class as regular images
    • Make a list of what types of data the application will capture
    • Research how the infinite scroll works
