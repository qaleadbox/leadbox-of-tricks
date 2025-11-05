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

Installation Guide > https://i.gyazo.com/4c47868b5ad910bb0403d626b518b906.gif


1. Open Chrome Browser.
2. Go to `chrome://extensions/`.
3. Enable **Developer Mode** (top right).
4. Download AND extract the last version [Here](https://github.com/qaleadbox/leadbox-of-tricks/releases)
5. Click [Load unpacked](https://i.gyazo.com/7a6fa8e891eb286d8b264c1d905a55a5.png)
6. Select the project folder to import the extension.

# How to use

## Feature001: Check Missing Images
Check for "coming soon" images on SRPs.

1. Navigate to any SRP page
2. Click "Scan for Coming Soon Images" button
3. If OCR is required:
   - Get your OCR API key from https://ocr.space/ocrapi/freekey
   - Enter the key in the popup
4. The extension will scan all images and identify "coming soon" ones

## Feature002: Check Small Images
Check for images that are too small (below minimum dimensions or file size).

1. Navigate to any SRP page
2. Click "Scan for Small Images" button
3. The extension will scan all images and identify those that are:
   - Below 300x200 pixels in dimensions
   - Below 10KB in file size
4. Small images will be highlighted with a red border and "SMALL IMAGE" label

## Feature003: CSV Data Matching
Validate SRP cards information against CSV data.

1. Navigate to any SRP page
2. Click "Validate SRP Cards with CSV Data" button
3. Copy your CSV data
4. Paste the data in the popup
5. The extension will compare the data and show matches/mismatches

## Feature004: HREF Extraction
Extract links from sitemap HTML structure for spreadsheet use.

Module003 Guide > https://i.gyazo.com/01bcde274738404aeabef2402b78b0fe.gif

1. Access the SiteMap
2. Inspect the elements list
3. Copy the ul element with li inside
4. Paste here (should follow this structure):

## Feature005: IMS Internals Leads Printer Icon
Automatically adds printer icons to leads list in the admin panel.

Working URLs:
- https://my.leadboxhq.net/leads/internal
- https://car-dealer-production-qa.azurewebsites.net/leads/internal

Steps:
1. Navigate to any of the working URLs above
2. The extension automatically adds printer icons next to each lead
3. Click the printer icon to view the printed version of the lead

## Feature 006: Text autofiller and fields saving
   - Access a any field
   - Type anything, click on save buttons
   - Type again, tap tab, it will autofill

## Feature007: IMS Internals Leads Edit Icon
Automatically adds printer icons to leads list in the admin panel.

Working URLs:
- https://my.leadboxhq.net/leads/internal
- https://car-dealer-production-qa.azurewebsites.net/leads/internal

# Structure

## File Tree
```
root/
├── icons/
│   ├── 16x16/                                      # 16x16 icons
│   ├── 48x48/                                      # 48x48 icons
│   └── 128x128/                                    # 128x128 icons
├── image-checker/
│   ├── ocr-image-checker.js                        # [SCRIPT] Space-OCR-API Integration
│   └── openai-image-checker.js                     # [SCRIPT] OpenAI-API Integration
├── $card-highlighter.js                            # [SHARED SCRIPT] Feature's vehicle cards highligher
├── $csv-exporter.js                                # [SHARED SCRIPT] Feature's CSV exporter
├── $data-handler.js                                # [SHARED SCRIPT] Feature's data handler
├── $scrolling.js                                   # [SHARED SCRIPT] Feature's scroller
├── background.js                                   # [BACKGROUND] Default extension file
├── coming-soon-checker.js                          # [MAIN SCRIPT] Coming Soon Images checker
├── intellisense-system.js                          # [MAIN SCRIPT] Intellisense system
├── content-intellisense.js                         # [AUXILIAR SCRIPT] Intellisense detailer scripts
├── csv-srp-data-matcher.js                         # [MAIN SCRIPT] CSV-SRP matcher
├── field-map-storage.js                            # [SCRIPT] Field map helper
├── lead-print-icon-injector.js                     # [MAIN SCRIPT] Leads printer icon script
├── manifest.json                                   # [MANIFEST] Default extension file
├── popup.html                                      # [POPUP] Default extension file
├── popup.js                                        # [SCRIPT] Popup actions
├── small-images-checker.js                         # [MAIN SCRIPT] Small Images checker
├── ul-link-extractor.js                            # [MAIN SCRIPT] Links extractor from Unordered Lists <ul> component
└── version.js                                      # [SCRIPT] Version handler
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
| Local Extension                                                                                                 | done |
| 100% Frontend (no backend, no JSON)                                                                             | done |
| Research how the infinite scroll works                                                                          | done |
| Saves the result to a CSV document                                                                              | done |
| View More button is a challenge                                                                                 | done |
| Implement the pagination by numbers                                                                             | done |
| Make a list of what types of data the application will capture                                                  | done |
| Compare .csv file with what's shown in the SRP                                                                  | done |
| Convert HREF from LI elements to paste on spreadsheet cells                                                     | done |
| Check if coming soon images have the same class as regular images                                               | pending |
| AI to detect Gray images(AMOS) OR if the images center are gray(CHRIS) OR detect images below 10KB(ROBINSON)    | done |

## Version History

- V3.7: Global manual vehicle's card css selectors (vehicle card, stock, model, img, price, etc)
- V3.6: Hotfix srpParser + logo spinner + debugmode option
- v3.5: IMS-Internals-Leads-Edit-Icon
- v3.4: LBX-text-autofiller
- v3.3: Allow-user-to-set-image-size-threshold Latest
- v3.2: Implemented checking images by OpenAI API
- v3.1: Added small images detection feature (detects images below 10KB)
- v3.0: CSV keys are reconixed dynamically after CSV data are inserted & Hotfix image links normalization
- v2.9: Hotfix all result values are normalized
- v2.8: Naming convention to files and buttons
- v2.7: Main methods are now in separate files
- v2.6: Importing/Exporting customized fields to a JSON file
- v2.5: Added support for locally persist customized classes
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

| Severity      | Description        |
|--------------------|---------------|
| HIGH | If pop up hiddes before the process finish, causes the reports not be generated |
| HIGH | In case of vehicle cards with this version https://countychevroletessex.com/search/ a different image is taken and causing false positives|
| MEDIUM | If OCR API was down, the cards should have a new tag "API is offline" |
| MEDIUM | Start a process, reopen popup, it will be not locked(loading) |
| MEDIUM | When any result is found, the icon keeps spinning|
| MEDIUM | Remove all hard code to implement full autodetect approach, occurrances on $data-handler.js > (e.g. "STOCKNUMBER", "KILOMETERS", "VIN", etc) |
| MEDIUM | Report file sometimes is being duplicated
| MEDIUM | Detect small images has not any loading feedback POPUP and SPINNER ICON
| LOW | Small images, if was runned more than once without clean the highlights the vehicle cards will became all red highlighed. THIS IS ONLY VISUAL. DO NOT IMPACTS FUNCTIONALITY.

# Suggestions

* Processes should start when tap ENTER
* When clicked outsite pop up, it closes and the data disappear
* Sometimes the extension process stops unexpectedly when the popup closes
* For check coming soon images, change the stockNumber column to the first on the output CSV file
* for comingsoonimagessize saved locally, save the image id instead the size, or both.
* OCR API is commonly down, should be good to test OCR locally
* "No matching CSV header found for field:" is logging on countychevrolet
* Remove the Field_mapleftover implementation from coming soon images module
* Add a dashboard to user choose options (e.g. debugMode)
* Add to the dashboard the exceptions and the normalization keys
* OCR is false negative on some sites - case the "coming soon" text has a not so readble font
* Add a stop button to break the checking while it is processing
* Elaborate test scenarios to regression
* Build a little test automation (embedded on the extension), tu run after every new code change
* Small images, currently it is reporting below 10KB, desired is 10KB be the minimum but user choose a customized value

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
