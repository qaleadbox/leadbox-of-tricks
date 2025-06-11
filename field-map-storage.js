async function getSiteDescription() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) {
            console.error('No active tab or URL found');
            return null;
        }

        const url = new URL(tab.url);
        return url.hostname.replace('www.', '');
    } catch (error) {
        console.error('Error getting site description:', error);
        return null;
    }
}

async function saveFieldMapValues(fieldMap) {
    const siteDescription = await getSiteDescription();
    if (!siteDescription) {
        console.error('Could not determine site description');
        return false;
    }
    
    try {
        const result = await chrome.storage.local.get([siteDescription]);
        const existingData = result[siteDescription] || {};
        
        const updatedData = {
            ...existingData,
            ...fieldMap
        };
        
        await chrome.storage.local.set({ [siteDescription]: updatedData });
        console.log(`Field map values saved for site: ${siteDescription}`);
        return true;
    } catch (error) {
        console.error('Error saving field map values:', error);
        return false;
    }
}

async function getFieldMapValues() {
    const siteDescription = await getSiteDescription();
    if (!siteDescription) {
        console.error('Could not determine site description');
        return null;
    }
    
    try {
        const result = await chrome.storage.local.get([siteDescription]);
        return result[siteDescription] || null;
    } catch (error) {
        console.error('Error getting field map values:', error);
        return null;
    }
}

async function getAllFieldMaps() {
    try {
        const result = await chrome.storage.local.get(null);
        const fieldMaps = {};
        
        for (const [key, value] of Object.entries(result)) {
            if (typeof value === 'object' && value !== null) {
                fieldMaps[key] = value;
            }
        }
        
        return fieldMaps;
    } catch (error) {
        console.error('Error getting all field maps:', error);
        return {};
    }
}

async function deleteFieldMap(siteDescription) {
    try {
        await chrome.storage.local.remove([siteDescription]);
        console.log(`Field map deleted for site: ${siteDescription}`);
        return true;
    } catch (error) {
        console.error('Error deleting field map:', error);
        return false;
    }
}

async function exportFieldMapsToJson() {
    try {
        const fieldMaps = await getAllFieldMaps();
        if (Object.keys(fieldMaps).length === 0) {
            console.log('No field maps to export');
            return false;
        }
        const jsonString = JSON.stringify(fieldMaps, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `LeadBox-of-Tricks-customized-data-${timestamp}.json`;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return true;
    } catch (error) {
        console.error('Error exporting field maps:', error);
        return false;
    }
}

async function importFieldMapsFromJson(jsonFile) {
    try {
        const text = await jsonFile.text();
        const fieldMaps = JSON.parse(text);
        
        if (Object.keys(fieldMaps).length === 0) {
            console.error('No field maps found in the imported file');
            return false;
        }
        
        for (const [key, value] of Object.entries(fieldMaps)) {
            if (typeof value === 'object' && value !== null) {
                await chrome.storage.local.set({ [key]: value });
            }
        }
        
        console.log('Field maps imported successfully');
        return true;
    } catch (error) {
        console.error('Error importing field maps:', error);
        return false;
    }
}

export {
    saveFieldMapValues,
    getFieldMapValues,
    getAllFieldMaps,
    deleteFieldMap,
    getSiteDescription,
    exportFieldMapsToJson,
    importFieldMapsFromJson
}; 