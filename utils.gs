/**
 * Utils.gs
 * Purpose: Cross-cutting utilities shared by both Board Meeting and Project Meeting scripts.
 *          Logging, date formatting, HTML escaping, common sheet operations.
 * Depends on: Config.gs
 * Last updated: 2026-08-07
 */

// ─── STRUCTURED ERROR LOGGING ────────────────────────────────

/**
 * Structured error logger. Use inside every catch block.
 * @param {string} context - Function name or step where error occurred.
 * @param {Error} error - The caught error object.
 */
function logError_(context, error) {
  const payload = {
    timestamp: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"),
    context: context,
    message: error.message,
    stack: error.stack || null,
  };
  Logger.log("ERROR [" + context + "]: " + error.message);
}

// ─── EXECUTION LOGGING (GENERIC) ──────────────────────────────

/**
 * Log a script execution event to the Log sheet.
 * Works for both board and project meetings.
 * @param {Date} startTime - When the execution started.
 * @param {string} emailType - Type of email (e.g., "BOARD_SUMMARY", "PROJECT_SUMMARY").
 * @param {string} recipient - Recipient email(s), comma-separated.
 * @param {string} status - Execution status (SUCCESS, FAILED, WARNING).
 * @param {string} summary - Short summary of what happened.
 */
function logExecution_(startTime, emailType, recipient, status, summary) {
  try {
    const sheet = getOrCreateSheet_(LOG_SHEET_NAME);

    if (!sheet) {
      Logger.log("Warning: Could not get Log sheet.");
      return;
    }

    // Initialize headers if first row is empty
    if (sheet.getLastRow() === 0) {
      initializeLogSheet_(sheet);
    }

    const timestamp = Utilities.formatDate(startTime, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    const duration = Math.round((new Date() - startTime) / 1000) + "s";

    sheet.appendRow([
      timestamp,
      emailType,
      recipient,
      status,
      summary,
      duration
    ]);

    Logger.log("Logged: " + timestamp + " | " + emailType + " | " + recipient + " | " + status);

  } catch (e) {
    logError_('logExecution_', e);
  }
}

/**
 * Initialize Log sheet with headers and formatting.
 * @param {Sheet} sheet - The Log sheet to initialize.
 */
function initializeLogSheet_(sheet) {
  try {
    sheet.appendRow([
      "Timestamp",
      "Email Type",
      "Recipient",
      "Status",
      "Summary",
      "Duration"
    ]);

    formatHeaderRow_(sheet, 6);

    sheet.setColumnWidth(1, 180);
    sheet.setColumnWidth(2, 120);
    sheet.setColumnWidth(3, 200);
    sheet.setColumnWidth(4, 100);
    sheet.setColumnWidth(5, 300);
    sheet.setColumnWidth(6, 80);

    Logger.log("Initialized Log sheet with headers.");

  } catch (e) {
    logError_('initializeLogSheet_', e);
  }
}

// ─── DATE UTILITIES ──────────────────────────────────────────

/**
 * Calculate cutoff date for lookback period.
 * @param {number} lookbackDays - Number of days to look back.
 * @return {Date} Date from lookbackDays ago at midnight.
 */
function getCutoffDate_(lookbackDays) {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - lookbackDays);
  return cutoff;
}

/**
 * Calculate age of file in days.
 * @param {Date} date - The file modification date.
 * @return {number} Number of days since the date.
 */
function getFileAgeInDays_(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

// ─── HTML UTILITIES ──────────────────────────────────────────

/**
 * Escape HTML special characters to prevent injection.
 * @param {string} str - String to escape.
 * @return {string} Escaped string safe for HTML.
 */
function escapeHtml_(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Format text with bullet points for HTML email.
 * @param {string} text - Text with newline-separated items.
 * @return {string} HTML-formatted bullet list or plain text.
 */
function formatBulletsHtml_(text) {
  if (!text || text === "Not available" || text === "None identified") {
    return `<span style="color:#bbb; font-style:italic;">None identified</span>`;
  }
  
  // Remove non-ASCII characters
  text = text.replace(/[^\x00-\x7F]/g, "");
  
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 1) return escapeHtml_(lines[0]);
  
  return "<ul style='margin:4px 0; padding-left:18px;'>" +
    lines.map(l => `<li style="margin-bottom:6px; font-size:12px;">${escapeHtml_(l.replace(/^[-•*]\s*/, ""))}</li>`).join("") +
    "</ul>";
}

// ─── SHEET OPERATIONS (GENERIC) ───────────────────────────────

/**
 * Get or create a sheet in the target spreadsheet.
 * @param {string} sheetName - Name of the sheet to get/create.
 * @return {Sheet} The sheet object.
 */
function getOrCreateSheet_(sheetName) {
  try {
    const ss = SpreadsheetApp.openById(MEETING_FILES_SPREADSHEET_ID);
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    return sheet;
  } catch (e) {
    logError_('getOrCreateSheet_', e);
    return null;
  }
}

/**
 * Format a header row in a sheet (dark slate background, white text, bold).
 * @param {Sheet} sheet - The sheet to format.
 * @param {number} numColumns - Number of columns in the header.
 */
function formatHeaderRow_(sheet, numColumns) {
  try {
    const headerRange = sheet.getRange(1, 1, 1, numColumns);
    headerRange.setBackground("#334155");
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
  } catch (e) {
    logError_('formatHeaderRow_', e);
  }
}

// ─── URL UTILITIES ───────────────────────────────────────────

/**
 * Extract Google Doc ID from a Google Docs URL.
 * @param {string} url - The full Google Docs URL.
 * @return {string} The Doc ID or null if not found.
 */
function extractDocId_(url) {
  const m = String(url).match(/[-\w]{25,}/);
  return m ? m[0] : null;
}

// ─── GET DOCUMENT CONTENT ────────────────────────────────────

/**
 * Get full text content from a Google Doc.
 * @param {string} fileId - The Google Doc ID.
 * @return {string} Full text content.
 * @throws {Error} If document cannot be opened.
 */
function getDocContent_(fileId) {
  try {
    const doc = DocumentApp.openById(fileId);
    return doc.getBody().getText();
  } catch (e) {
    logError_('getDocContent_', e);
    throw new Error("Could not read document: " + e.message);
  }
}

// ─── GET MEETING FILES (GENERIC) ──────────────────────────────

/**
 * Get all meeting files from a specified sheet within lookback period.
 * Works for both board and project meetings.
 * @param {string} sheetName - Name of the sheet (e.g., "boardFiles", "files").
 * @param {number} lookbackDays - Number of days to look back.
 * @param {string[]} keywords - Optional keywords to filter by. If empty, no filtering.
 * @return {Object[]} Array of {id, name, url, lastModified}
 */
function getMeetingFiles_(sheetName, lookbackDays, keywords) {
  Logger.log("Fetching meeting files from '" + sheetName + "' sheet...");

  try {
    const sheet = getOrCreateSheet_(sheetName);
    if (!sheet) {
      Logger.log("Sheet '" + sheetName + "' not found.");
      return [];
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      Logger.log("Sheet is empty (no data rows).");
      return [];
    }

    const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    const cutoff = getCutoffDate_(lookbackDays);

    const fileMap = {};
    const files = [];

    for (const row of values) {
      const name = String(row[0] || "").trim();
      const url = String(row[1] || "").trim();
      const lastModified = row[2] instanceof Date ? row[2] : new Date(row[2]);

      if (!name || !url) continue;
      if (isNaN(lastModified.getTime()) || lastModified < cutoff) continue;

      // Filter by keywords if provided
      if (keywords && keywords.length > 0) {
        const nameLower = name.toLowerCase();
        const matchesKeyword = keywords.some(kw => nameLower.includes(kw.toLowerCase()));
        if (!matchesKeyword) continue;
      }

      const id = extractDocId_(url);
      if (!id) continue;

      // Keep most recent version of each file (by ID)
      if (!fileMap[id] || lastModified > fileMap[id].lastModified) {
        fileMap[id] = { id, name, lastModified, url };
      }
    }

    Object.values(fileMap).forEach(file => files.push(file));
    files.sort((a, b) => b.lastModified - a.lastModified);

    Logger.log("Found " + files.length + " unique meeting file(s).");
    return files;

  } catch (e) {
    logError_('getMeetingFiles_', e);
    return [];
  }
}

/**
 * Get the most recent file date across all rows in a specified sheet.
 * Used to detect stale data (whether upstream fetch script has run recently).
 * Works for both board and project meetings.
 * @param {string} sheetName - Name of the sheet (e.g., "boardFiles", "files").
 * @return {Date} Most recent file modification date, or null if none found.
 */
function getMostRecentFileDate_(sheetName) {
  try {
    const sheet = getOrCreateSheet_(sheetName);
    if (!sheet) {
      Logger.log("Sheet '" + sheetName + "' not found.");
      return null;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;

    const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    let mostRecent = null;

    for (const row of values) {
      const d = row[2] instanceof Date ? row[2] : new Date(row[2]);
      if (isNaN(d.getTime())) continue;
      if (!mostRecent || d > mostRecent) mostRecent = d;
    }

    return mostRecent;

  } catch (e) {
    logError_('getMostRecentFileDate_', e);
    return null;
  }
}

function getRecipient_(productionRecipient) {
  if (DEBUG_MODE) {
    Logger.log("DEBUG MODE: Sending to " + DEBUG_EMAIL + " instead of production");
    return DEBUG_EMAIL;
  }
  return productionRecipient;
}