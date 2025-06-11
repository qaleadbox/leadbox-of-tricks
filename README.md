# LeadBox of Tricks Chrome Extension

A powerful Chrome extension designed to enhance LeadBox functionality with tools for inventory management, data extraction, and admin panel improvements. This extension provides a suite of features to help dealers and administrators work more efficiently with their vehicle inventory and lead management.

## Key Features
- **Image Analysis**: Automatically detect "coming soon" images on SRP pages
- **Data Validation**: Match CSV data against SRP cards for inventory verification
- **Link Extraction**: Extract and format links from sitemaps for spreadsheet use
- **Admin Tools**: Enhanced printer functionality in the LeadBox admin panel

## Target Users
- Vehicle dealers
- Inventory managers
- LeadBox administrators
- Data analysts

# **How to install**

## Google Chrome

### Installing the extension 

[![Installation Guide](https://gyazo.com/4c47868b5ad910bb0403d626b518b906)](https://gyazo.com/4c47868b5ad910bb0403d626b518b906)


1. Open Chrome Browser.
2. Go to `chrome://extensions/`.
3. Enable **Developer Mode** (top right).
4. Clone or download the repository: https://github.com/robinsonmourao/Inventory-Crawl-Chrome-Extension.
5. Click [Load unpacked](https://gyazo.com/7a6fa8e891eb286d8b264c1d905a55a5)
6. Select the project folder to import the extension.

# How to use

## Feature001: Check Missing Images
Check for "coming soon" images on SRPs.

1. Navigate to any SRP page
2. Click "Find coming soon images" button
3. If OCR is required:
   - Get your OCR API key from https://ocr.space/ocrapi/freekey
   - Enter the key in the popup
4. The extension will scan all images and identify "coming soon" ones

## Feature002: CSV Data Matching
Validate SRP cards information against CSV data.

1. Navigate to any SRP page
2. Click "Validate SRP Cards with CSV Data" button
3. Copy your CSV data
4. Paste the data in the popup
5. The extension will compare the data and show matches/mismatches

## Feature003: HREF Extraction
Extract links from sitemap HTML structure for spreadsheet use.

[![Module003 Guide](https://gyazo.com/01bcde274738404aeabef2402b78b0fe)](https://gyazo.com/01bcde274738404aeabef2402b78b0fe)

1. Access the SiteMap
2. Inspect the elements list
3. Copy the ul element with li inside
4. Paste here (should follow this structure):

## Feature004: LeadBox Admin Printer
Automatically adds printer icons to leads list in the admin panel.

Working URLs:
- https://my.leadboxhq.net/leads/internal
- https://car-dealer-production-qa.azurewebsites.net/leads/internal

Steps:
1. Navigate to any of the working URLs above
2. The extension automatically adds printer icons next to each lead
3. Click the printer icon to view the printed version of the lead

# Structure

## Folders

```
root/
├── icons/                                          # Extension Icon's folder
│   ├── 16x16/                                      # 16x16 icons
│   ├── 48x48/                                      # 48x48 icons
│   └── 128x128/                                    # 128x128 icons
├── Image Checker/                                  # Checking coming soon images module
│   ├── imageCheckerByOCR.js                        # OCR integration Script
│   └── imageCheckerByOpenAI.js                     # OpenAI integration Script
├── popup.html                                      # Interface HTML file
├── check missing images.js                         # Crawl coming soon images script
├── match csv data with SRP cards information.js    # CSV-SRP Cards comparison script
├── HREF extraction to spreadsheet.js               # HREF extractor script
├── hack backend admin printer icon.js              # Customized listener script for backend admin
├── background.js                                   # Background behavior file
├── version.js                                      # Version management script
├── manifest.json                                   # Main configuration file
└── README.md                                       # This Markdown instructions file
```

# Requirements

- Google Chrome browser (version 88 or higher)
- OCR API key (only required for Feature001 when using OCR)
- Access to LeadBox admin panel (for Feature004)

# Troubleshooting

## Common Issues

1. OCR API Timeout
   - Check your internet connection
   - Verify your OCR API key is valid
   - Try again after a few minutes

2. CSV Data Matching Issues
   - Ensure CSV data is properly formatted
   - Check if the SRP page is fully loaded
   - Verify column headers match expected format

3. Printer Icons Not Appearing
   - Confirm you're on a supported URL
   - Check if the extension is enabled
   - Try refreshing the page

# Development tracking

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

## Version History

- v2.4: Added support for comparing vehicle card main image links between CSV and SRP.
- v2.3: Added customized classes to vehicles cards CSS selector
- v2.2: Hofix Check CSV-SRP module pages scrolling
- v2.1: Loading feedback to extension icon and popup
- v2.0: Input the OCR key by popup field
- v1.9: Added OCR key management
- v1.8: Improved CSV data matching
- v1.7: Cards get visual progress feedback
- v1.6: Added printer icon feature
- v1.5: Extract links from sitemaps
- v1.4: Support View More Vehicles button added
- v1.3: Exporting results to a CSV file
- v1.2: AutoScrolling implemented
- v1.1: Vehicles counter
- v1.0: Google Chrome porting

# Known Issues

* The scroll does not follow the currently processing card;
    * Additionally, on paginated sites, the processing queue functions correctly, but the next page loads too early, making it difficult to locate the currently processing card.
* If OCR API was down, any timeout is being thrown;

# Suggestions

* Processes should start when tap ENTER
* When clicked outsite pop up, it closes and the data disappear
* For check coming soon images, change the stockNumber column to the first on the output CSV file


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
