/**
 * Service_Claude.gs
 * Purpose: Shared Claude API integration for both Board and Project meeting summaries.
 *          Handles model fallback, prompt caching, date normalization, and response parsing.
 * Depends on: Config.gs (API key, system instructions), Utils.gs (logging, escaping)
 * Last updated: 2026-08-07
 */

// ─── GENERIC CLAUDE SUMMARIZATION ────────────────────────────

/**
 * Summarize a meeting document using Claude.
 * Works for both board and project meetings based on systemInstructions parameter.
 * Tries multiple models with fallback logic.
 * @param {string} fileName - Name of the meeting file.
 * @param {string} content - Full text content from the document.
 * @param {string} systemInstructions - System instructions for Claude (BOARD_ or PROJECT_SYSTEM_INSTRUCTIONS).
 * @param {boolean} includeFilenameHint - Whether to extract and include filename date hint.
 * @return {Object} {summary: {parsed fields}, usage: {input_tokens, output_tokens}}
 * @throws {Error} If all models fail.
 */
function summarizeMeetingWithClaude_(
  fileName,
  content,
  systemInstructions,
  includeFilenameHint,
) {
  const trimmedContent =
    content.length > 10000
      ? content.substring(0, 10000) + "\n\n[Document truncated]"
      : content;

  // Extract date hint from filename if requested
  let dateContext = "";
  if (includeFilenameHint) {
    const filenameDateHint = extractDateFromFilename_(fileName);
    dateContext = filenameDateHint
      ? `\n\nFilename suggests date: ${filenameDateHint}`
      : "";
  }

  const userMessage = `Meeting: "${fileName}"

CONTENT:
${trimmedContent}${dateContext}`;

  // Try models in order with fallback
  for (let i = 0; i < CLAUDE_MODELS.length; i++) {
    const model = CLAUDE_MODELS[i];
    Logger.log("   Trying model: " + model);

    try {
      const result = callClaudeApi_(model, userMessage, systemInstructions);
      Logger.log("   Success!");
      return result;
    } catch (e) {
      Logger.log("   Failed: " + e.message);
      if (i === CLAUDE_MODELS.length - 1) {
        throw new Error("All Claude models failed: " + e.message);
      }
      Utilities.sleep(1000);
    }
  }
}

/**
 * Call Claude API with given message and system instructions.
 * @param {string} model - Claude model name.
 * @param {string} userMessage - Message to send.
 * @param {string} systemInstructions - System prompt.
 * @return {Object} {summary: {parsed response}, usage: {...}}
 * @throws {Error} If API call fails.
 */
function callClaudeApi_(model, userMessage, systemInstructions) {
  const apiKey = getClaudeApiKey_();
  if (!apiKey) {
    throw new Error("CLAUDE_API_KEY not found in Script Properties");
  }

  const payload = {
    model: model,
    max_tokens: 1000,
    system: [
      {
        type: "text",
        text: systemInstructions,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  };

  const options = {
    method: "POST",
    contentType: "application/json",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(
    "https://api.anthropic.com/v1/messages",
    options,
  );
  const responseCode = response.getResponseCode();
  const json = JSON.parse(response.getContentText());

  if (responseCode !== 200) {
    const errorMsg = json.error ? json.error.message : "HTTP " + responseCode;
    throw new Error(errorMsg);
  }

  if (json.error) throw new Error("Claude API error: " + json.error.message);
  if (!json.content || json.content.length === 0)
    throw new Error("Empty response");

  if (json.usage) {
    Logger.log(
      "    Tokens — input: " +
        json.usage.input_tokens +
        ", cache_read: " +
        (json.usage.cache_read_input_tokens || 0) +
        ", output: " +
        json.usage.output_tokens,
    );
  }

  return {
    summary: parseClaudeResponse_(json.content[0].text),
    usage: json.usage,
  };
}

/**
 * Parse Claude's response into structured fields.
 * Handles both board (MEETING_DATE, TOP_ISSUES, KEY_DECISIONS, ACTION_ITEMS)
 * and project (PROJECT_NAME, MEETING_DATE, CONCERNS_AND_RISKS, SUCCESSES_AND_WINS, PEOPLE_AND_STAKEHOLDERS) formats.
 * @param {string} text - Raw response text from Claude.
 * @return {Object} Parsed fields with normalized dates.
 */
function parseClaudeResponse_(text) {
  const extract = (label) => {
    const regex = new RegExp(label + ":\\s*([\\s\\S]*?)(?=\\n[A-Z_]+:|$)");
    const match = text.match(regex);
    return match ? match[1].trim() : "Not available";
  };

  // Normalize meeting date field
  let meetingDate = extract("MEETING_DATE");
  meetingDate = normalizeDateFormat_(meetingDate);

  // Return all possible fields (some may be "Not available" depending on meeting type)
  return {
    projectName: extract("PROJECT_NAME"),
    meetingDate: meetingDate,
    topIssues: extract("TOP_ISSUES"),
    keyDecisions: extract("KEY_DECISIONS"),
    actionItems: extract("ACTION_ITEMS"),
    concerns: extract("CONCERNS_AND_RISKS"),
    successes: extract("SUCCESSES_AND_WINS"),
    people: extract("PEOPLE_AND_STAKEHOLDERS"),
  };
}

// ─── DATE EXTRACTION & NORMALIZATION ─────────────────────────

/**
 * Extract 6-digit date from filename.
 * Example: "270730 - Board Meeting" → normalizes to consistent format.
 * @param {string} fileName - The filename to extract from.
 * @return {string} Normalized date string or null.
 */
function extractDateFromFilename_(fileName) {
  const match = String(fileName).match(/^(\d{6})/);
  if (match) {
    const dateStr = match[1];
    return normalizeDateFormat_(dateStr);
  }
  return null;
}

/**
 * Normalize various date formats to "dd mmmm yyyy".
 * Intelligently handles ambiguous 6-digit dates (YYMMDD vs DDMMYY)
 * by picking the interpretation closest to today.
 * @param {string} dateStr - Date string in any format.
 * @return {string} Normalized date in "dd mmmm yyyy" format.
 */
function normalizeDateFormat_(dateStr) {
  if (!dateStr || dateStr === "Not available" || dateStr === "Not specified") {
    return "Not specified";
  }

  dateStr = String(dateStr).trim();
  let parsedDate = null;

  // Pattern 1: 6-digit format (YYMMDD or DDMMYY) - try both interpretations
  if (/^\d{6}$/.test(dateStr)) {
    try {
      const part1 = parseInt(dateStr.substring(0, 2));
      const part2 = parseInt(dateStr.substring(2, 4));
      const part3 = parseInt(dateStr.substring(4, 6));
      const today = new Date();

      // Interpretation 1: YYMMDD
      let date1 = null;
      if (part2 >= 1 && part2 <= 12 && part3 >= 1 && part3 <= 31) {
        const yyyy1 = part1 < 50 ? 2000 + part1 : 1900 + part1;
        date1 = new Date(yyyy1, part2 - 1, part3);
      }

      // Interpretation 2: DDMMYY
      let date2 = null;
      if (part2 >= 1 && part2 <= 12 && part1 >= 1 && part1 <= 31) {
        const yyyy2 = part3 < 50 ? 2000 + part3 : 1900 + part3;
        date2 = new Date(yyyy2, part2 - 1, part1);
      }

      // Pick the one closer to today
      if (date1 && date2) {
        const diff1 = Math.abs(date1 - today);
        const diff2 = Math.abs(date2 - today);
        parsedDate = diff1 < diff2 ? date1 : date2;
      } else if (date1) {
        parsedDate = date1;
      } else if (date2) {
        parsedDate = date2;
      }
    } catch (e) {
      // Continue to next pattern
    }
  }

  // Pattern 2: DD/MM/YYYY format
  if (!parsedDate || isNaN(parsedDate.getTime())) {
    const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      try {
        const dd = parseInt(match[1]);
        const mm = parseInt(match[2]);
        const yyyy = parseInt(match[3]);
        parsedDate = new Date(yyyy, mm - 1, dd);
      } catch (e) {
        // Continue
      }
    }
  }

  // Pattern 3: DD MMM YYYY or DD MMMM YYYY
  if (!parsedDate || isNaN(parsedDate.getTime())) {
    const match = dateStr.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/);
    if (match) {
      try {
        parsedDate = new Date(match[0]);
      } catch (e) {
        // Continue
      }
    }
  }

  // Format if successfully parsed
  if (parsedDate && !isNaN(parsedDate.getTime())) {
    return Utilities.formatDate(
      parsedDate,
      Session.getScriptTimeZone(),
      "dd MMMM yyyy",
    );
  }

  return dateStr;
}
