export function exportToCSVFile(data, testType, siteName) {
    switch (testType){
        case "CSV_SRP_DATA_MATCHER": {
            if (!data || typeof data !== 'object') {
                alert('No data to export!');
                return;
            }
        
            const filename = `${siteName}_${testType.toUpperCase()}_${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')}.csv`;
            const lines = ['StockNumber,Field,CSV,SRP'];
        
            for (const stockNumber in data) {
                const mismatches = data[stockNumber].mismatches;
                if (mismatches && Object.keys(mismatches).length > 0) {
                    for (const field in mismatches) {
                        const { srp, csv } = mismatches[field];
                        lines.push(`"${stockNumber}","${field}","${csv}","${srp}"`);
                    }
                }
            }

            if (lines.length <= 1) {
                alert('No mismatches found to export!');
                return;
            }
        
            const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
            break;
        }
        
        case "COMING_SOON_DETECTOR": {
            if (!data || data.length === 0) {
                alert('No data to export!');
                return;
            }
    
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
            const filename = `${siteName}_${testType.toUpperCase()}_${timestamp}.csv`;
    
            const headers = ['Model', 'Trim', 'Stock Number', 'Image URL'];
            const rows = data.map(item => [item.model, item.trim, item.stockNumber, item.imageUrl]);
    
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(value => `"${value}"`).join(','))
            ].join('\n');
    
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
    
            link.href = url;
            link.download = `${filename}.csv`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            break;
        }
        
        case "SMALL_IMAGE_DETECTOR": {
            if (!data || data.length === 0) {
                alert('No data to export!');
                return;
            }
    
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
            const filename = `${siteName}_${testType.toUpperCase()}_${timestamp}.csv`;
    
            const headers = ['Stock Number', 'Model', 'Image Size (KB)', 'Timestamp'];
            const rows = data.map(item => [
                item.stockNumber, 
                item.model, 
                typeof item.imageSize === 'number' ? item.imageSize.toFixed(2) : item.imageSize, 
                item.timestamp
            ]);
    
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(value => `"${value}"`).join(','))
            ].join('\n');
    
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
    
            link.href = url;
            link.download = `${filename}.csv`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            break;
        }
    }    
}