export const downloadCSV = (dataArray, filename) => {
  if (!dataArray || !dataArray.length) {
    alert("No data available to export.");
    return;
  }
  
  const headers = Object.keys(dataArray[0]).join(",");
  const rows = dataArray.map(obj => 
    Object.values(obj).map(val => {
      // Handle nulls and undefined
      if (val === null || val === undefined) return '""';
      // Escape quotes and wrap in quotes
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(",")
  );
  
  const csvContent = [headers, ...rows].join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
