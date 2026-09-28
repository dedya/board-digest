# Board Digest: AI Meeting Summaries, Delivered by Email

Board Digest is an automation that reads an organisation's meeting notes, uses AI to pick out what matters, and emails a short, clearly formatted digest to leadership on a fixed schedule. Nobody has to write it by hand.

I built it for a real organisation. Before sharing it, I replaced all names, email addresses and document IDs with placeholders.

---

## The problem

Board members and senior managers can't read every meeting document their teams produce. Someone ends up writing summaries by hand, which is slow, uneven in quality, and easy to skip when people are busy.

## The solution

Board Digest produces two recurring reports:

| Report | Schedule | Audience | What it pulls out |
|---|---|---|---|
| **Board Meeting Summary** | Monthly (14th, 6 PM) | Board of directors | Top issues, key decisions, action items |
| **Project Meeting Summary** | Weekly (Friday, 4 PM) | Leadership | Project name, concerns and risks, successes and wins, people and stakeholders |

Each report arrives as a branded HTML email. Every summary links back to its original document, so readers can open the full notes whenever they need to.

---

## How it works

```
 Google Sheet             Google Docs              Claude AI              Gmail
 (list of meeting   ──▶   (meeting notes   ──▶    (reads & extracts ──▶  (formatted digest
  documents)               are read)               key points)            sent to readers)
                                                                              │
                                                     Log sheet  ◀─────────────┘
                                                     (every run is recorded)
```

1. A spreadsheet lists recent meeting documents. A separate upstream process keeps this list up to date.
2. On schedule, the script picks the documents from the relevant time window (the last 30 days for the board report, the last 7 days for the project report).
3. It sends each document to Claude (Anthropic's AI model) with instructions to return a fixed structure.
4. It turns the AI's answers into a clean email and sends it to the configured recipients.
5. It records the outcome of every run (success, warning or failure) in a log sheet.

---

## Built to be reliable, not just to work in a demo

Most of the work in this project went into making it safe to leave running unattended:

- **Checks for stale data.** If the source list hasn't been updated recently, the script doesn't send an outdated report. It stops and alerts the administrator instead.
- **Falls back to a second AI model.** If the primary model fails, the script retries with another one before giving up.
- **Keeps going when one file fails.** One unreadable document doesn't stop the whole report. The script skips that file and processes the rest.
- **Alerts on failure.** Administrators get an email when something goes wrong: a missing configuration, no files found, or every file failing.
- **Keeps an audit log.** Every run records its timestamp, report type, recipients, status and duration in a spreadsheet.
- **Has a safe test mode.** One switch sends all emails to a test address, so changes can be checked without emailing the board.
- **Stores the API key securely.** The key lives in Google's secure script properties, not in the code.
- **Keeps AI costs down.** It uses prompt caching and caps document length to reduce API usage.
- **Handles ambiguous dates.** File names like `270730` can be read as more than one date format, so the script picks the interpretation closest to today.
- **Escapes email content.** All text is escaped before it goes into the email HTML, which prevents broken or unsafe markup.

---

## Skills demonstrated

- **Workflow automation:** scheduled, unattended business processes
- **AI integration:** calling a large language model API, designing prompts, and turning AI output into reliable, structured data
- **Google Workspace development:** Apps Script with Sheets, Docs, Gmail and time-based triggers
- **Clean code structure:** configuration, business logic, email and utilities kept in separate files, with every function documented
- **Operational thinking:** monitoring, alerting, logging, test modes and secure handling of secrets
- **Stakeholder focus:** turning long documents into short summaries that busy executives can act on

---

## Tech stack

- **Google Apps Script** (JavaScript)
- **Anthropic Claude API** (Claude Haiku as the primary model, Claude Sonnet as the fallback)
- **Google Sheets, Google Docs and Gmail**

---

## Project structure

| File | Responsibility |
|---|---|
| `config.gs` | All settings in one place: recipients, schedules, branding, AI instructions |
| `main.gs` | Entry points and orchestration for the two reports, plus trigger setup |
| `service_claude.gs` | AI integration: model fallback, response parsing, date handling |
| `service_email.gs` | Builds and sends the HTML digest and the alert emails |
| `utils.gs` | Shared helpers: logging, spreadsheet access, HTML safety |

---

## Setup (for technical reviewers)

1. Create a Google Apps Script project and add the five `.gs` files.
2. In `config.gs`, fill in the placeholders: `BRAND_CONFIG`, the spreadsheet ID, and the recipient and alert email addresses.
3. Put your Claude API key in `setApiKeyOnce()`, run it once, then remove the key from the code.
4. Run `setupMonthlyBoardSummaryTrigger()` and `setupWeeklyProjectSummaryTrigger()` once to schedule the reports. Times follow the script project's time zone.
5. Set `DEBUG_MODE = true` and run `testBoardMeetingSummary()` or `testWeeklySummary()` to preview the emails safely.

The source spreadsheet needs one tab per report (`boardFiles` and `files`) with three columns: **file name**, **Google Doc URL** and **last modified date**.
