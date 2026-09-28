/**
 * Main.gs
 * Purpose: Entry points for both Board Meeting (monthly) and Project Meeting (weekly) summaries.
 *          Orchestration logic only; business logic lives in Service_*.gs files.
 * Depends on: Config.gs, Utils.gs, Service_Claude.gs, Service_Email.gs
 * Last updated: 2026-08-07
 */

// ═════════════════════════════════════════════════════════════
//  BOARD MEETING SUMMARY — Monthly (14th of month, 6:00 PM)
// ═════════════════════════════════════════════════════════════

/**
 * Main orchestration function for monthly board meeting summary.
 * Runs on 14th of month at 6:00 PM script time zone.
 * Pulls all board meeting files, summarizes with Claude, sends to recipients.
 */
function runBoardMeetingSummaryMonthly() {
  Logger.log("\n" + "=".repeat(70));
  Logger.log("BOARD MEETING SUMMARY — Monthly Run");
  Logger.log("=".repeat(70));
  Logger.log("Started at: " + new Date());

  const runStartTime = new Date();
  let executionStatus = "STARTED";
  let executionSummary = "";

  try {
    // Validate API key
    if (!getClaudeApiKey_()) {
      Logger.log("❌ CLAUDE_API_KEY not found.");
      executionStatus = "FAILED";
      executionSummary = "API key configuration missing";
      sendAlertEmail_(
        BOARD_CONFIG.ALERT_EMAIL,
        BOARD_CONFIG.ALERT_SUBJECT,
        "API key missing",
        "CLAUDE_API_KEY not found in Script Properties",
        "runBoardMeetingSummaryMonthly",
        MEETING_FILES_SPREADSHEET_ID
      );
      logExecution_(runStartTime, "BOARD_SUMMARY", "N/A", executionStatus, executionSummary);
      return;
    }

    // Check if source sheet is fresh
    const mostRecentFileDate = getMostRecentFileDate_(BOARD_CONFIG.SHEET_NAME);
    if (!mostRecentFileDate || mostRecentFileDate < getCutoffDate_(BOARD_CONFIG.LOOKBACK_DAYS)) {
      Logger.log("⚠️ Source sheet appears stale. Sending alert.");
      sendStaleDataAlert_(
        BOARD_CONFIG.SHEET_NAME,
        BOARD_CONFIG.LOOKBACK_DAYS,
        mostRecentFileDate,
        BOARD_CONFIG.ALERT_EMAIL,
        BOARD_CONFIG.ALERT_SUBJECT,
        MEETING_FILES_SPREADSHEET_ID
      );
      executionStatus = "WARNING";
      executionSummary = "Stale data detected - alert sent";
      logExecution_(runStartTime, "BOARD_SUMMARY", "N/A", executionStatus, executionSummary);
      return;
    }

    // Get board meeting files (no keyword filtering)
    const boardMeetingFiles = getMeetingFiles_(BOARD_CONFIG.SHEET_NAME, BOARD_CONFIG.LOOKBACK_DAYS, null);
    if (!boardMeetingFiles || boardMeetingFiles.length === 0) {
      Logger.log("⚠️ No board meeting files found.");
      executionStatus = "WARNING";
      executionSummary = "No board meeting files found";
      sendAlertEmail_(
        BOARD_CONFIG.ALERT_EMAIL,
        BOARD_CONFIG.ALERT_SUBJECT,
        "No board meeting files found",
        "The '" + BOARD_CONFIG.SHEET_NAME + "' sheet contains no entries.",
        "runBoardMeetingSummaryMonthly",
        MEETING_FILES_SPREADSHEET_ID
      );
      logExecution_(runStartTime, "BOARD_SUMMARY", "N/A", executionStatus, executionSummary);
      return;
    }

    Logger.log("✅ Found " + boardMeetingFiles.length + " board meeting file(s).");

    // Process each file
    const allSummaries = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < boardMeetingFiles.length; i++) {
      const fileInfo = boardMeetingFiles[i];
      Logger.log("\nFile " + (i + 1) + "/" + boardMeetingFiles.length + ": " + fileInfo.name);

      try {
        const fileAge = getFileAgeInDays_(fileInfo.lastModified);
        if (fileAge > BOARD_CONFIG.MAX_FILE_AGE_DAYS) {
          Logger.log("  File is older than " + BOARD_CONFIG.MAX_FILE_AGE_DAYS + " days. Skipping.");
          failureCount++;
          continue;
        }

        let content = getDocContent_(fileInfo.id);
        if (!content || content.trim().length < 100) {
          Logger.log("  Content too short. Skipping.");
          failureCount++;
          continue;
        }

        Logger.log("  Summarizing with Claude...");
        const { summary } = summarizeMeetingWithClaude_(fileInfo.name, content, BOARD_SYSTEM_INSTRUCTIONS, true);

        allSummaries.push({
          name: fileInfo.name,
          url: fileInfo.url,
          date: fileInfo.lastModified,
          summary: summary,
        });

        successCount++;
        Utilities.sleep(1000);

      } catch (e) {
        Logger.log("  Error: " + e.message);
        logError_('boardFileLoop', e);
        failureCount++;
      }
    }

    // Send email only if we have usable summaries
    if (successCount === 0) {
      Logger.log("\n❌ All files failed to process.");
      executionStatus = "FAILED";
      executionSummary = "All " + boardMeetingFiles.length + " files failed";
      sendAlertEmail_(
        BOARD_CONFIG.ALERT_EMAIL,
        BOARD_CONFIG.ALERT_SUBJECT,
        "All files failed",
        "Attempted to process " + boardMeetingFiles.length + " file(s), but all failed.",
        "runBoardMeetingSummaryMonthly",
        MEETING_FILES_SPREADSHEET_ID
      );
      logExecution_(runStartTime, "BOARD_SUMMARY", "N/A", executionStatus, executionSummary);
      return;
    }

    // Build and send email
    Logger.log("\nBuilding email...");
    const html = buildBoardEmailHtml_(allSummaries);
    const subject = BOARD_CONFIG.EMAIL_SUBJECT + " - " +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "d MMM yyyy");
    const boardRecipients = getRecipient_(BOARD_CONFIG.RECIPIENT_EMAILS);
    sendMeetingEmail_(boardRecipients, subject, html);
    
    Logger.log("✅ Board meeting summary sent successfully");
    Logger.log("   Files: " + successCount + " successful, " + failureCount + " skipped");

    executionStatus = "SUCCESS";
    executionSummary = "Processed " + successCount + " file(s)";
    logExecution_(runStartTime, "BOARD_SUMMARY", BOARD_CONFIG.RECIPIENT_EMAILS.join(", "), executionStatus, executionSummary);

  } catch (e) {
    Logger.log("❌ Unexpected error: " + e.message);
    logError_('runBoardMeetingSummaryMonthly', e);
    executionStatus = "FAILED";
    executionSummary = e.message;
    sendAlertEmail_(
      BOARD_CONFIG.ALERT_EMAIL,
      BOARD_CONFIG.ALERT_SUBJECT,
      "Unexpected error",
      "An error occurred:\n\n" + e.message,
      "runBoardMeetingSummaryMonthly",
      MEETING_FILES_SPREADSHEET_ID
    );
    logExecution_(runStartTime, "BOARD_SUMMARY", "N/A", executionStatus, executionSummary);
  }

  Logger.log("COMPLETED at: " + new Date());
  Logger.log("=".repeat(70) + "\n");
}

// ═════════════════════════════════════════════════════════════
//  PROJECT MEETING SUMMARY — Weekly (Friday, 4:00 PM)
// ═════════════════════════════════════════════════════════════

/**
 * Main orchestration function for weekly project meeting summary.
 * Runs every Friday at 4:00 PM script time zone.
 * Pulls project meeting files, summarizes with Claude, sends to recipients.
 */
function runWeeklySummary() {
  Logger.log("\n" + "=".repeat(70));
  Logger.log("PROJECT MEETING SUMMARY — Weekly Run");
  Logger.log("=".repeat(70));
  Logger.log("Started at: " + new Date());

  const runStartTime = new Date();
  let executionStatus = "STARTED";
  let executionSummary = "";

  try {
    // Validate API key
    if (!getClaudeApiKey_()) {
      Logger.log("❌ CLAUDE_API_KEY not found.");
      executionStatus = "FAILED";
      executionSummary = "API key configuration missing";
      logExecution_(runStartTime, "PROJECT_SUMMARY", PROJECT_CONFIG.RECIPIENT_EMAIL, executionStatus, executionSummary);
      return;
    }

    // Check if source sheet is fresh
    const mostRecentFileDate = getMostRecentFileDate_(PROJECT_CONFIG.SHEET_NAME);
    if (!mostRecentFileDate || mostRecentFileDate < getCutoffDate_(PROJECT_CONFIG.LOOKBACK_DAYS)) {
      Logger.log("⚠️ Source sheet appears stale. Sending alert.");
      sendStaleDataAlert_(
        PROJECT_CONFIG.SHEET_NAME,
        PROJECT_CONFIG.LOOKBACK_DAYS,
        mostRecentFileDate,
        PROJECT_CONFIG.ALERT_EMAIL,
        PROJECT_CONFIG.ALERT_SUBJECT,
        MEETING_FILES_SPREADSHEET_ID
      );
      executionStatus = "WARNING";
      executionSummary = "Stale data detected - alert sent";
      logExecution_(runStartTime, "PROJECT_SUMMARY", PROJECT_CONFIG.RECIPIENT_EMAIL, executionStatus, executionSummary);
      return;
    }

    // Get project meeting files (with keyword filtering)
    const projectMeetingFiles = getMeetingFiles_(PROJECT_CONFIG.SHEET_NAME, PROJECT_CONFIG.LOOKBACK_DAYS, PROJECT_CONFIG.TITLE_KEYWORDS);
    if (!projectMeetingFiles || projectMeetingFiles.length === 0) {
      Logger.log("⚠️ No project meeting files found.");
      executionStatus = "WARNING";
      executionSummary = "No project meeting files found";
      logExecution_(runStartTime, "PROJECT_SUMMARY", PROJECT_CONFIG.RECIPIENT_EMAIL, executionStatus, executionSummary);
      return;
    }

    Logger.log("✅ Found " + projectMeetingFiles.length + " project meeting file(s).");

    // Process each file
    const allSummaries = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < projectMeetingFiles.length; i++) {
      const fileInfo = projectMeetingFiles[i];
      Logger.log("\nFile " + (i + 1) + "/" + projectMeetingFiles.length + ": " + fileInfo.name);

      try {
        let content = getDocContent_(fileInfo.id);
        if (!content || content.trim().length < 100) {
          Logger.log("  Content too short. Skipping.");
          failureCount++;
          continue;
        }

        Logger.log("  Summarizing with Claude...");
        const { summary } = summarizeMeetingWithClaude_(fileInfo.name, content, PROJECT_SYSTEM_INSTRUCTIONS, false);

        allSummaries.push({
          name: fileInfo.name,
          url: fileInfo.url,
          date: fileInfo.lastModified,
          summary: summary,
        });

        successCount++;
        Utilities.sleep(1000);

      } catch (e) {
        Logger.log("  Error: " + e.message);
        logError_('projectFileLoop', e);
        failureCount++;
      }
    }

    // Send email only if we have usable summaries
    if (successCount === 0) {
      Logger.log("\n❌ All files failed to process.");
      executionStatus = "FAILED";
      executionSummary = "All " + projectMeetingFiles.length + " files failed";
      logExecution_(runStartTime, "PROJECT_SUMMARY", PROJECT_CONFIG.RECIPIENT_EMAIL, executionStatus, executionSummary);
      return;
    }

    // Build and send email
    Logger.log("\nBuilding email...");
    const html = buildProjectEmailHtml_(allSummaries);
    const subject = PROJECT_CONFIG.EMAIL_SUBJECT + " - " +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "d MMM yyyy");
    const projectRecipient = getRecipient_(PROJECT_CONFIG.RECIPIENT_EMAIL);
    sendMeetingEmail_(projectRecipient, subject, html);

    Logger.log("✅ Project meeting summary sent successfully");
    Logger.log("   Files: " + successCount + " successful, " + failureCount + " skipped");

    executionStatus = "SUCCESS";
    executionSummary = "Processed " + successCount + " file(s)";
    logExecution_(runStartTime, "PROJECT_SUMMARY", PROJECT_CONFIG.RECIPIENT_EMAIL, executionStatus, executionSummary);

  } catch (e) {
    Logger.log("❌ Unexpected error: " + e.message);
    logError_('runWeeklySummary', e);
    executionStatus = "FAILED";
    executionSummary = e.message;
    logExecution_(runStartTime, "PROJECT_SUMMARY", PROJECT_CONFIG.RECIPIENT_EMAIL, executionStatus, executionSummary);
  }

  Logger.log("COMPLETED at: " + new Date());
  Logger.log("=".repeat(70) + "\n");
}

// ─── TRIGGER SETUP ───────────────────────────────────────────

/**
 * Set up monthly trigger for board meeting summary.
 * Runs on 14th of each month at 6:00 PM script time zone.
 * Run this manually once, then delete.
 */
function setupMonthlyBoardSummaryTrigger() {
  Logger.log("Setting up monthly board summary trigger...");
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === "runBoardMeetingSummaryMonthly") {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  ScriptApp.newTrigger("runBoardMeetingSummaryMonthly")
    .timeBased()
    .onMonthDay(14)
    .atHour(18)
    .nearMinute(0)
    .create();
  Logger.log("✅ Trigger set: 14th of each month at 6:00 PM script time zone");
}

/**
 * Set up weekly trigger for project meeting summary.
 * Runs every Friday at 4:00 PM script time zone.
 * Run this manually once, then delete.
 */
function setupWeeklyProjectSummaryTrigger() {
  Logger.log("Setting up weekly project summary trigger...");
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === "runWeeklySummary") {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  ScriptApp.newTrigger("runWeeklySummary")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(16)
    .create();
  Logger.log("✅ Trigger set: Every Friday at 4:00 PM script time zone");
}

// ─── MANUAL TESTING ──────────────────────────────────────────

/**
 * Manually trigger board meeting summary (for testing).
 */
function testBoardMeetingSummary() {
  Logger.log("TEST RUN — Board Meeting Summary");
  runBoardMeetingSummaryMonthly();
}

/**
 * Manually trigger project meeting summary (for testing).
 */
function testWeeklySummary() {
  Logger.log("TEST RUN — Project Meeting Summary");
  runWeeklySummary();
}