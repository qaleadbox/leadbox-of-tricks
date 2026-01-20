//$csv-exporter.js
export function exportToCSVFile(data, testType, siteName, primaryKeyField = 'stockNumber') {
    console.log('📤 exportToCSVFile called with:', { testType, dataLength: data?.length, siteName, primaryKeyField });
    switch (testType){
        case "CSV_SRP_DATA_MATCHER": {
            if (!data || typeof data !== 'object') {
                alert('No data to export!');
                return;
            }
        
            const filename = `${siteName}_${testType.toUpperCase()}_${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')}.csv`;
            const lines = [`${primaryKeyField},Field,CSV,SRP`];
        
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
            console.log('📤 CSV EXPORTER received data:', data);
            console.log('📤 CSV EXPORTER data length:', data ? data.length : 0);

            if (!data || data.length === 0) {
                alert('No data to export!');
                return;
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
            const filename = `${siteName}_${testType.toUpperCase()}_${timestamp}.csv`;

            const headers = ['Model', 'Trim', primaryKeyField, 'Image URL'];
            const rows = data.map(item => [item.model, item.trim, item.stockNumber, item.imageUrl]);
            console.log('📤 CSV EXPORTER creating', rows.length, 'rows');
    
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

            const headers = [primaryKeyField, 'Model', 'Image Size (KB)', 'Timestamp'];
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

        case "VEHICLE_DATA_EXPORTER": {
            console.log('📤 CSV EXPORTER received vehicle data:', data);
            console.log('📤 CSV EXPORTER data length:', data ? data.length : 0);

            if (!data || data.length === 0) {
                alert('No vehicle data to export!');
                return;
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
            const filename = `${siteName}_VEHICLE_DATA_${timestamp}`;

            // Collect all unique field names from the first vehicle (all should have same fields)
            const allFields = new Set();
            data.forEach(vehicle => {
                Object.keys(vehicle).forEach(field => allFields.add(field));
            });

            // Convert to array and sort (primary key first, then model, trim, then alphabetically)
            const headers = Array.from(allFields).sort((a, b) => {
                if (a === primaryKeyField) return -1;
                if (b === primaryKeyField) return 1;
                if (a === 'model') return -1;
                if (b === 'model') return 1;
                if (a === 'trim') return -1;
                if (b === 'trim') return 1;
                return a.localeCompare(b);
            });

            console.log('📋 CSV Headers:', headers);
            console.log('📋 Total fields to export:', headers.length);

            // Create rows with only the selected fields
            const rows = data.map(vehicle => {
                return headers.map(header => {
                    const value = vehicle[header] || '';
                    // Properly escape quotes in CSV
                    return `"${String(value).replace(/"/g, '""')}"`;
                });
            });

            const csvContent = [
                headers.map(h => `"${h}"`).join(','),
                ...rows.map(row => row.join(','))
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

            console.log(`✅ Exported ${data.length} vehicles with ${headers.length} fields to ${filename}.csv`);
            break;
        }
    }
}