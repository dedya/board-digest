/**
 * Config.gs
 * Purpose: Centralized configuration for both Board Meeting and Project Meeting summary scripts.
 *          All IDs, sheet names, constants, and secrets go here.
 * Depends on: PropertiesService (for API key storage)
 * Last updated: 2026-08-07
 */

const DEBUG_MODE = false; // Set to true for testing, false for production
const DEBUG_EMAIL = "[your-test-email]";

// ─── BRANDING ────────────────────────────────────────────────

const BRAND_CONFIG = {
  ORG_NAME: "[Your Organisation]",
  SENDER_NAME: "Meeting Digest",
  WEBSITE: "[your-website]",
};

// ─── SPREADSHEET CONFIGURATION ───────────────────────────────

const MEETING_FILES_SPREADSHEET_ID = "[your meeting file spreadsheet id]";
const LOG_SHEET_NAME = "Log";

// ─── BOARD MEETING CONFIGURATION ─────────────────────────────

const BOARD_CONFIG = {
  SHEET_NAME: "boardFiles",
  RECIPIENT_EMAILS: ["[board1-email]", "[board2-email]"],
  ALERT_EMAIL: "[support-email]",
  EMAIL_SUBJECT: "Board Meeting Summary",
  ALERT_SUBJECT: "[Alert] Board Meeting Summary Failed",
  LOOKBACK_DAYS: 30,
  MAX_FILE_AGE_DAYS: 30,
};

// ─── PROJECT MEETING CONFIGURATION ──────────────────────────

const PROJECT_CONFIG = {
  SHEET_NAME: "files",
  RECIPIENT_EMAIL: "[board-email]",
  ALERT_EMAIL: "[it-email]",
  EMAIL_SUBJECT: "Weekly Project Meeting Summary",
  ALERT_SUBJECT: "[Alert] Weekly Project Summary Failed",
  LOOKBACK_DAYS: 7,
  TITLE_KEYWORDS: ["meeting"],
};

// ─── CLAUDE CONFIGURATION ───────────────────────────────────

const CLAUDE_MODELS = ["claude-haiku-4-5", "claude-sonnet-4-6"];

const BOARD_SYSTEM_INSTRUCTIONS = `You are a senior executive advisor to a board of directors at ${BRAND_CONFIG.ORG_NAME}.

Extract TOP-LEVEL ISSUES and KEY DECISIONS that require board attention.

Focus on:
- Major risks or blockers
- Strategic decisions or milestones
- Financial or governance concerns
- Key deliverables and status
- Action items with owners

IMPORTANT for MEETING_DATE:
- If filename contains a date suggestion, use that date
- Otherwise extract from document content
- If document has old/wrong date, prefer filename date

Return EXACTLY this format (no markdown, no special chars):

MEETING_DATE: [date in dd/mm/yyyy or "Not specified"]
TOP_ISSUES: [2-4 key issues in plain text, each on new line starting with dash]
KEY_DECISIONS: [decisions in plain text, or "None identified"]
ACTION_ITEMS: [action items in plain text, or "None identified"]`;

const PROJECT_SYSTEM_INSTRUCTIONS = `You are a senior analyst at ${BRAND_CONFIG.ORG_NAME}.

You will be given the text of a project meeting document. Analyse it and extract the following four fields. Be concise and specific. Use bullet points within each field if there are multiple items. If a field has no relevant content, write "None identified."

Return your response in this EXACT format (do not add any other text before or after):

PROJECT_NAME: [name of the project discussed, or infer from context]
MEETING_DATE: [date of the meeting, or "Not specified"]
CONCERNS_AND_RISKS: [key concerns, risks, or challenges raised]
SUCCESSES_AND_WINS: [positive outcomes, milestones achieved, or good news]
PEOPLE_AND_STAKEHOLDERS: [names of people, teams, partners, or organisations mentioned]`;

// ─── SECRETS (from PropertiesService) ────────────────────────

/**
 * Retrieves Claude API key from Script Properties.
 * Set once via setApiKeyOnce() function, then clear the key string.
 * @return {string} Claude API key or null if not set.
 */
function getClaudeApiKey_() {
  return PropertiesService.getScriptProperties().getProperty("CLAUDE_API_KEY");
}

/**
 * ONE-TIME setup function to store API key securely.
 * Replace THE-KEY with your actual key, run once, then clear this function.
 */
function setApiKeyOnce() {
  PropertiesService.getScriptProperties().setProperty(
    "CLAUDE_API_KEY",
    "THE-KEY",
  );
  Logger.log("API key saved to Script Properties.");
}
