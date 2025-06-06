# **How to install**

## Google Chrome

### Installing the extension 

[![Installation Guide](https://gyazo.com/4c47868b5ad910bb0403d626b518b906)](https://gyazo.com/4c47868b5ad910bb0403d626b518b906)

1. Open CHROME BROWSER.
2. Access `chrome://extensions/`.
3. Enable **Developer Mode**.
4. Clone/Download the repository https://github.com/robinsonmourao/Inventory-Crawl-Chrome-Extension.
5. Click on [Load unpacked](https://gyazo.com/7a6fa8e891eb286d8b264c1d905a55a5)
6. Select the project folder.
7. Some sites use API to make the reviewings, inform the API KEY if is necessary.
   7a. Create a file on the project's root called "/config.js"
   7b. Crete a constant on it
   `export const OCR_API_KEY = '<your-api-key-here>';`

# How to use

## Module001: Convert HREF from LI elements to paste on spreadsheet cells

[![Module001 Guide](https://gyazo.com/01bcde274738404aeabef2402b78b0fe)](https://gyazo.com/01bcde274738404aeabef2402b78b0fe)

1. Access the SiteMap
2. Inspect the elements list
3. Copy the ul element with li inside
4. Paste here (should follow this structure):


# Structure

## Folders

```
root/
├── icons -> Extension Icon's folder.
    ├── 16x16 -> 16x16 icons
    ├── 48x48 -> 48x48 icons
    └── 128x128 -> 128x128 icons
├── Image Checker -> Checking coming soon images module.
    ├── imageCheckerByOCR.js -> OCR (Optical Character Recognition) integration Script.
    └── imageCheckerByOpenAI.js -> image checker by Open AI integration Script.
├── popup.html -> Interface HTML file.
├── check missing images.js -> Crawl coming soon images script.
├── match csv data with SRP cards information.js -> CSV-SRP Cards data comparisson script.
├── HREF extraction to spreadsheet.js -> HREF extrator script.
├── hack backend admin printer icon.js -> Customized listener script for backend admin.
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
| Saves the result to a CSV document                                | done |
| View More button is a challenge                                   | done |
| Implement the pagination by numbers                               | done |
| Make a list of what types of data the application will capture    | done |
| Compare .csv file with what's shown in the SRP                    | done |
| Convert HREF from LI elements to paste on spreadsheet cells       | done |
| Check if coming soon images have the same class as regular images | pending |
| Use AI for the comparison                                         | pending |

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
