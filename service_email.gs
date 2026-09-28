/**
 * Service_Email.gs
 * Purpose: Shared email generation and sending for both Board and Project meetings.
 *          Builds professional HTML emails and sends to recipients.
 * Depends on: Config.gs (recipient emails), Utils.gs (HTML utilities)
 * Last updated: 2026-08-07
 */

// ─── BOARD MEETING EMAIL BUILDING ────────────────────────────

/**
 * Build a professional HTML email for board meeting summaries.
 * @param {Object[]} summaries - Array of {name, url, date, summary: {...}}
 * @return {string} Complete HTML email body.
 */
function buildBoardEmailHtml_(summaries) {
  const today = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "d MMMM yyyy",
  );
  let summaryRows = "";

  for (let i = 0; i < summaries.length; i++) {
    const item = summaries[i];
    const s = item.summary;

    const fileLink = `<a href="${escapeHtml_(item.url)}" style="color:#334155; text-decoration:none; font-weight:bold;">${escapeHtml_(item.name)}</a>`;

    summaryRows += `
      <tr>
        <td colspan="2" style="padding:16px; background:#f9f9f9; border-top:2px solid #334155;">
          <strong style="font-size:14px;">${i + 1}. ${fileLink}</strong><br>
          <span style="color:#888; font-size:12px;">Meeting date: ${escapeHtml_(s.meetingDate)}</span>
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:12px 16px; border-bottom:1px solid #e0e0e0;">
          <strong style="color:#c0392b; font-size:12px;">TOP ISSUES:</strong><br>
          ${formatBulletsHtml_(s.topIssues)}
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:12px 16px; border-bottom:1px solid #e0e0e0;">
          <strong style="color:#27ae60; font-size:12px;">KEY DECISIONS:</strong><br>
          ${formatBulletsHtml_(s.keyDecisions)}
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:12px 16px; border-bottom:1px solid #e0e0e0;">
          <strong style="color:#e67e22; font-size:12px;">ACTION ITEMS:</strong><br>
          ${formatBulletsHtml_(s.actionItems)}
        </td>
      </tr>
      <tr><td colspan="2" style="height:12px;"></td></tr>
    `;
  }

  return buildEmailTemplate_(
    BRAND_CONFIG.ORG_NAME.toUpperCase() + " BOARD",
    "Executive Summary",
    "Meeting Summary",
    summaryRows,
    summaries.length,
    today,
  );
}

// ─── PROJECT MEETING EMAIL BUILDING ──────────────────────────

/**
 * Build a professional HTML email for project meeting summaries.
 * @param {Object[]} summaries - Array of {name, url, date, summary: {...}}
 * @return {string} Complete HTML email body.
 */
function buildProjectEmailHtml_(summaries) {
  const today = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "d MMMM yyyy",
  );
  let summaryRows = "";

  for (let i = 0; i < summaries.length; i++) {
    const item = summaries[i];
    const s = item.summary;

    const fileLink = `<a href="${escapeHtml_(item.url)}" style="color:#334155; text-decoration:none; font-weight:bold;">${escapeHtml_(item.name)}</a>`;

    summaryRows += `
      <tr>
        <td colspan="2" style="padding:16px; background:#f9f9f9; border-top:2px solid #334155;">
          <strong style="font-size:14px;">${i + 1}. ${fileLink}</strong><br>
          <span style="color:#888; font-size:12px;">Meeting date: ${escapeHtml_(s.meetingDate)}</span>
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:12px 16px; border-bottom:1px solid #e0e0e0;">
          <strong style="color:#334155; font-size:12px;">PROJECT:</strong><br>
          <span style="font-size:13px;">${escapeHtml_(s.projectName)}</span>
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:12px 16px; border-bottom:1px solid #e0e0e0;">
          <strong style="color:#c0392b; font-size:12px;">CONCERNS & RISKS:</strong><br>
          ${formatBulletsHtml_(s.concerns)}
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:12px 16px; border-bottom:1px solid #e0e0e0;">
          <strong style="color:#27ae60; font-size:12px;">SUCCESSES & WINS:</strong><br>
          ${formatBulletsHtml_(s.successes)}
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:12px 16px; border-bottom:1px solid #e0e0e0;">
          <strong style="color:#4B5563; font-size:12px;">PEOPLE & STAKEHOLDERS:</strong><br>
          ${formatBulletsHtml_(s.people)}
        </td>
      </tr>
      <tr><td colspan="2" style="height:12px;"></td></tr>
    `;
  }

  return buildEmailTemplate_(
    BRAND_CONFIG.ORG_NAME.toUpperCase(),
    "Project Meetings",
    "Weekly Summary",
    summaryRows,
    summaries.length,
    today,
  );
}

// ─── SHARED EMAIL TEMPLATE ───────────────────────────────────

/**
 * Build a reusable email template for both meeting types.
 * @param {string} headerTitle - Main title (e.g., "ACME BOARD", "ACME").
 * @param {string} headerSubtitle - Subtitle (e.g., "Executive Summary", "Project Meetings").
 * @param {string} rightTitle - Right column title (e.g., "Meeting Summary").
 * @param {string} summaryRows - HTML for summary content rows.
 * @param {number} fileCount - Number of files reviewed.
 * @param {string} today - Today's date formatted.
 * @return {string} Complete HTML email body.
 */
function buildEmailTemplate_(
  headerTitle,
  headerSubtitle,
  rightTitle,
  summaryRows,
  fileCount,
  today,
) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#f4f7fb; font-family:Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb; padding:32px 0;">
    <tr><td align="center">
      <table width="760" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#334155; padding:28px 32px;" colspan="2">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <div style="font-family:'Trebuchet MS',Arial,sans-serif; font-size:22px; font-weight:bold; color:#ffffff;">${headerTitle}</div>
                <div style="font-size:13px; color:#CBD5E1; margin-top:2px;">${headerSubtitle}</div>
              </td>
              <td align="right">
                <div style="font-family:'Trebuchet MS',Arial,sans-serif; font-size:18px; font-weight:bold; color:#ffffff;">${rightTitle}</div>
                <div style="font-size:13px; color:#CBD5E1; margin-top:2px;">${today}</div>
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- Accent bar -->
        <tr><td colspan="2" style="background:#94A3B8; height:4px;"></td></tr>

        <!-- Intro -->
        <tr>
          <td colspan="2" style="padding:24px 32px 16px; color:#4B5563; font-size:14px; line-height:1.6;">
            <strong>${fileCount} meeting file(s)</strong> reviewed.
          </td>
        </tr>

        <!-- Summary content -->
        <tr>
          <td colspan="2" style="padding:0 32px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; border:1px solid #e0e0e0; border-radius:6px; overflow:hidden;">
              ${summaryRows}
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td colspan="2" style="background:#f4f7fb; padding:20px 32px; border-top:1px solid #e0e0e0;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="font-size:12px; color:#aaa;">Auto-generated meeting summary. Click file names to open docs.</td>
              <td align="right" style="font-size:12px; color:#334155; font-weight:bold;">${escapeHtml_(BRAND_CONFIG.WEBSITE)}</td>
            </tr></table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── EMAIL SENDING ───────────────────────────────────────────

/**
 * Send meeting summary email to recipients.
 * Sends ONE email to multiple recipients (comma-separated).
 * @param {string|string[]} recipients - Email address(es): string or array of strings.
 * @param {string} subject - Email subject.
 * @param {string} html - HTML email body.
 * @throws {Error} If email send fails.
 */
function sendMeetingEmail_(recipients, subject, html) {
  const recipientStr = Array.isArray(recipients)
    ? recipients.join(",")
    : recipients;
  const plaintext =
    "Your email client does not support HTML. Please view in a modern email client.";

  try {
    GmailApp.sendEmail(recipientStr, subject, plaintext, {
      htmlBody: html,
      name: BRAND_CONFIG.SENDER_NAME,
    });
    Logger.log("Email sent to: " + recipientStr);
  } catch (e) {
    logError_("sendMeetingEmail_", e);
    throw e;
  }
}

/**
 * Send an alert email when something goes wrong.
 * @param {string} alertEmail - Alert recipient email.
 * @param {string} alertSubjectPrefix - Email subject prefix (e.g., "[Alert] Board Meeting Summary Failed").
 * @param {string} subject - Subject (appended after prefix).
 * @param {string} body - Email body text.
 * @param {string} scriptName - Name of the script (for logging).
 * @param {string} spreadsheetId - Spreadsheet ID (for reference).
 */
function sendAlertEmail_(
  alertEmail,
  alertSubjectPrefix,
  subject,
  body,
  scriptName,
  spreadsheetId,
) {
  const fullSubject = alertSubjectPrefix + " - " + subject;
  const fullBody =
    body +
    "\n\n" +
    "---\n" +
    "Script: " +
    scriptName +
    "\n" +
    "Ran: " +
    new Date() +
    "\n" +
    "Spreadsheet: " +
    spreadsheetId;

  try {
    GmailApp.sendEmail(alertEmail, fullSubject, fullBody);
    Logger.log("Alert sent to: " + alertEmail);
  } catch (e) {
    logError_("sendAlertEmail_", e);
  }
}

/**
 * Send stale data alert when source sheet hasn't been updated recently.
 * @param {string} sheetName - Name of the sheet (e.g., "boardFiles", "files").
 * @param {number} lookbackDays - Lookback period in days.
 * @param {Date} mostRecentFileDate - Most recent file date from sheet.
 * @param {string} alertEmail - Alert recipient email.
 * @param {string} alertSubjectPrefix - Email subject prefix.
 * @param {string} spreadsheetId - Spreadsheet ID.
 */
function sendStaleDataAlert_(
  sheetName,
  lookbackDays,
  mostRecentFileDate,
  alertEmail,
  alertSubjectPrefix,
  spreadsheetId,
) {
  const dateStr = mostRecentFileDate
    ? Utilities.formatDate(
        mostRecentFileDate,
        Session.getScriptTimeZone(),
        "d MMMM yyyy 'at' HH:mm",
      )
    : "no valid dates found";

  const subject = "Stale data in " + sheetName + " sheet";
  const body =
    "The script did not run because the source data looks stale.\n\n" +
    "Sheet: " +
    sheetName +
    "\n" +
    "Most recent file logged: " +
    dateStr +
    "\n" +
    "Lookback window: " +
    lookbackDays +
    " days\n\n" +
    "This usually means the upstream fetch script hasn't run yet (or failed). " +
    "Please check the fetch script / trigger order and re-run manually once the sheet has been refreshed.\n\n" +
    "url: https://docs.google.com/spreadsheets/d/" +
    spreadsheetId +
    "/edit?gid=0#gid=0";

  sendAlertEmail_(
    alertEmail,
    alertSubjectPrefix,
    subject,
    body,
    "Meeting Summary Script",
    spreadsheetId,
  );
}
