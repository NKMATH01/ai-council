# Stitch UI Integration

## Overview

`/api/generate-ui` now uses Google Stitch first. The server sends the PRD or harness artifacts to Stitch, downloads the generated HTML, and returns that HTML to the existing prototype preview panel.

Gemini HTML generation remains available as a fallback by sending:

```json
{ "uiProvider": "gemini" }
```

## Required Environment Variables

Production needs one of these auth options:

```bash
STITCH_API_KEY=...
```

or OAuth:

```bash
STITCH_ACCESS_TOKEN=...
GOOGLE_CLOUD_PROJECT=...
```

Optional:

```bash
STITCH_PROJECT_ID=...
STITCH_HOST=https://stitch.googleapis.com/mcp
```

If `STITCH_PROJECT_ID` is omitted, the server creates a new Stitch project named `AI Council Prototypes`.

## Runtime Flow

1. User clicks `Stitch로 생성`.
2. Client calls `/api/generate-ui` with `uiProvider: "stitch"`.
3. Server creates or reuses a Stitch project.
4. Server calls Stitch `generate_screen_from_text` through `@google/stitch-sdk`.
5. Server downloads the generated HTML and screenshot URL.
6. Client shows the HTML in the existing iframe preview.

## Notes

- Stitch generation can take a few minutes.
- The HTML contains an `ai-council-stitch` metadata comment with `projectId`, `screenId`, and optional `imageUrl`.
- Vercel currently must have `STITCH_API_KEY` configured before production generation will work.
