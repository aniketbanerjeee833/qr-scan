
const HEADER_FILL = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFDC2626" },
};

const THIN = { style: "thin", color: { argb: "FFD1D5DB" } };


export const toDateKey = (value) =>
  new Date(value).toLocaleDateString("en-CA", { timeZone: TZ });

// "20-11-2026"
export const toDateLabel = (key) => key.split("-").reverse().join("-");
const TZ = "Asia/Kolkata";
export const toTimeLabel = (value) =>
  new Date(value).toLocaleTimeString("en-IN", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  export const addSheet = (
    workbook,
    name,
    { title, info = [], headers, widths, rows }
  ) => {
    const sheet = workbook.addWorksheet(name);
  
    widths.forEach((width, index) => {
      sheet.getColumn(index + 1).width = width;
    });
  
    const titleRow = sheet.addRow([title]);
    titleRow.font = { bold: true, size: 14 };
  
    info.forEach(([label, value]) => {
      const row = sheet.addRow([`${label}: ${value}`]);
      row.font = { bold: true };
    });
  
    sheet.addRow([]);
  
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
  
    headerRow.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.border = { top: THIN, left: THIN, bottom: THIN, right: THIN };
    });
  
    rows.forEach((values) => {
      const row = sheet.addRow(values);
  
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber <= headers.length) {
          cell.border = { top: THIN, left: THIN, bottom: THIN, right: THIN };
        }
      });
    });
  
    if (!rows.length) {
      const empty = sheet.addRow(["No visits found for this period"]);
      empty.font = { italic: true, color: { argb: "FF6B7280" } };
    }
  
    sheet.views = [{ state: "frozen", ySplit: headerRow.number }];
  
    sheet.autoFilter = {
      from: { row: headerRow.number, column: 1 },
      to: { row: headerRow.number, column: headers.length },
    };
  
    return sheet;
  };
  
  export const sendWorkbook = async (res, workbook, filename) => {
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
  
    await workbook.xlsx.write(res);
    res.end();
  };