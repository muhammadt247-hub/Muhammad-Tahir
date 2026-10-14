# DOCTORx — Microstock Research & Metadata Toolkit

**DOCTORx** is a high-performance web toolkit for stock contributors (Adobe Stock, Shutterstock, Freepik). It combines a market-research and analytics engine for Adobe Stock (with prompt reverse-engineering and local moodboards) and an AI metadata generator for high-volume batches (up to 200 assets) with CSV exports formatted to platform upload templates.

---

## Features

- **Adobe Stock Market Analytics (`/adobe-analytics`)**:
  - **Three Search Modes**:
    1. **Search by Keyword**: Explore marketplace keywords, trends, download volume, and AI vs. Non-AI distribution ratios across Adobe Stock.
    2. **Search by File ID**: Inspect an exact asset by numeric ID (`FILE #`) or by pasting any Adobe Stock URL (e.g. `https://stock.adobe.com/stock-photo/id/2063124677` or `.../images/.../2063124677`). Extracts the numeric file ID, queries the official Adobe Stock Search API with `media_id`, and displays that single asset in a centered card (max 420px) without unrelated items. Includes a direct "More from this contributor" button to pivot to the creator's full portfolio. In demo mode, clearly indicates that File ID search requires live data (never shows fake images for specific file IDs). Restores state from `?mode=file&q=<id>`.
    3. **Search by Contributor ID**: Analyze portfolios by Contributor ID or pasted profile URL (`stock.adobe.com/contributor/ID/name`). If a user inputs a File ID instead, DOCTORx detects it and offers a friendly one-click prompt: *"This looks like a File ID. Search it in the File ID tab?"*.
  - Sort by Most Downloads, Relevance, Newest (creation date), Featured, or Undiscovered.
  - Filter by Content Type (Photo, Illustration, Vector, 3D, Video, Template, Audio) and Generative AI status (All, Non-AI only, AI generated only).
  - Live statistics breakdown: total assets found, Non-AI count, AI count.
  - Transparent Demo Mode: clear dismissible banner, header notice (*"Demo results. These are not real Adobe Stock assets"*), and `DEMO` badge on every demo card.
  - Pixel-faithful Asset Cards: high-resolution thumbnails, relative age pill, type badge, AI/Non-AI badge, 10 keyword chips, download & upload date metrics, one-click copy for titles and comma-separated keywords, and external deep links.
  - Official Adobe Stock Search API integration with realistic, deterministic offline mock fallback when no Adobe key is configured.
  - Export to CSV (with UTF-8 BOM for Microsoft Excel), XLSX, and structured JSON.

- **Reverse Image Prompt Generator**:
  - Multimodal AI vision analysis using Gemini (`@google/genai`).
  - Target generator options: Midjourney v6, FLUX.1 / SDXL, Gemini / Imagen 3, DALL-E 3, Universal.
  - Deconstructs composition, lighting, camera/lens specs, hex color palette, and style keywords.
  - Negative prompt generation and editable prompt text area.
  - Cache results locally per asset ID.

- **Moodboards & Collections**:
  - Zero-login, client-side saved collections stored in `localStorage`.
  - Offline asset caching with full metadata preservation.
  - Keyword frequency analysis across saved assets.
  - Export collections to CSV and JSON, or copy all unique deduplicated tags with one click.

- **In-Place Metadata Embedding Engine**:
  - Direct byte manipulation writing Title, Description, and Keywords into JPEG and PNG image files.
  - Zero pixel re-encoding: pixel stream remains 100% byte-identical.
  - JPEG: EXIF (ImageDescription, XPTitle, XPKeywords), IPTC (ObjectName, Headline, Caption, Keywords), and XMP (`dc:title`, `dc:description`, `dc:subject`).
  - PNG: XMP packet inside standard `iTXt` chunk with `XML:com.adobe.xmp` and valid CRC-32 checksum.
  - Yields cooperatively to the browser UI during processing to prevent lag.
  - Packages processed files into a single download ZIP.

- **Bulk Metadata Generator (`/generator`)**:
  - Handles up to **200 assets per batch** without browser memory degradation.
  - Windowed card list above 50 items for silky-smooth 60fps rendering.
  - Client-side downsampling to 1024px JPEG and 160px preview URLs before upload.
  - Concurrency queue of 4 workers with exponential backoff retry and quota pause-resume.
  - Target marketplaces: **Adobe Stock, Shutterstock, Freepik, Generic CSV**.
  - Simultaneous multi-platform export as a unified ZIP archive containing platform-specific CSVs.
  - Bulk operations: deduplicate tags, trim keywords to marketplace limit, find and replace across titles and tags, retry failed rows.
  - Warnings highlighted in amber when title or keyword limits are exceeded.

- **Modern App Shell & Design System**:
  - Poppins typography, dual high-contrast Light and Dark palettes.
  - Collapsible sidebar (260px expanded, 72px collapsed) with mobile off-canvas drawer.
  - Local workspace profile with full JSON data import/export and reset.
  - **Zero credits, zero paywalls, zero login walls.**

---

## How to Get a Live Adobe Stock API Key

To query live Adobe Stock data and inspect specific assets by File ID:

1. **Open Adobe Developer Console**: Go to [https://developer.adobe.com/console](https://developer.adobe.com/console) and log in with your Adobe ID.
2. **Create a Project**: Click **Create new project** (or select an existing one).
3. **Add Adobe Stock API**:
   - In your project, click **Add API**.
   - Under Adobe services, choose **Adobe Stock**.
4. **Generate Credentials**:
   - Choose the OAuth / API Key credential type.
   - Note your generated **API Key (Client ID)**.
5. **Add to `.env.local`**:
   ```bash
   ADOBE_STOCK_API_KEY=your_adobe_client_id_here
   ADOBE_STOCK_PRODUCT_NAME=DOCTORx/1.0
   ```
6. **Restart Dev Server**: Start the application (`npm run dev`). DOCTORx will automatically detect the key, deactivate demo mode badges, and serve live results directly from Adobe Stock.

---

## Environment Variables

Copy `.env.example` to `.env.local` to customize:

| Variable | Description | Required |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key. Injected automatically in AI Studio. | Yes (for AI features) |
| `GEMINI_MODEL` | Gemini model name (default: `gemini-3.8-flash`). | Optional |
| `ADOBE_STOCK_API_KEY` | Official Adobe Stock API key for live search queries. | Optional (runs in demo mode without it) |
| `ADOBE_STOCK_PRODUCT_NAME` | Client product header for Adobe Stock API (default: `DOCTORx/1.0`). | Optional |

---

## Folder Map

```
app/
  layout.tsx                  # Root layout (Poppins font, next-themes, AppShell)
  globals.css                 # Design tokens (HSL variables, glass-card, shimmer)
  page.tsx                    # Landing redirect to /generator
  icon.svg                    # Vector geometric logo favicon
  not-found.tsx               # Styled 404 page
  error.tsx                   # Styled error boundary
  adobe-analytics/page.tsx    # Adobe Analytics tool page (temporary placeholder in Step 1)
  generator/page.tsx          # Batch Metadata Generator page (temporary placeholder in Step 1)
  tools/page.tsx              # Toolkit registry catalog
  api/
    stock/search/route.ts     # Adobe Stock search endpoint (TTL cache + rate limit)
    prompt/route.ts           # Multimodal Gemini image-to-prompt endpoint
    generator/metadata/route.ts # Gemini stock title/description/keywords endpoint
    image-proxy/route.ts      # Image proxy for CDN hotlink protection
components/
  ui/                         # Radix UI primitives (Button, Input, Select, Dialog, etc.)
  layout/                     # AppShell, Sidebar, ThemeToggle, ProfileCard, SettingsDialog
  analytics/                  # SearchCard, FilterBar, ResultsHeader, ResultsGrid, AssetCard, PromptDialog, MoodboardsDialog, SaveToBoardPopover, ExportMenu, EmptyState
  generator/                  # UploadZone, SettingsPanel, ResultsTable, KeywordEditor, ExportMenu
  Logo.tsx                    # Doctor silhouette with devil horns & stethoscope SVG
config/
  site.ts                     # Brand strings, URLs, meta tags
  tools.ts                    # Tool registry catalog
  platforms.ts                # Adobe, Shutterstock, Freepik column specifications & limits
  ai.ts                       # Default Gemini model config
lib/
  storage.ts                  # Typed, versioned localStorage helper
  format.ts                   # Date, relative time, compact number formatters
  csv.ts                      # Papaparse CSV, SheetJS XLSX, and JSZip multi-platform export
  gemini.ts                   # Server-side @google/genai client
  rate-limit.ts               # In-memory per-IP token bucket rate limiter
  cache.ts                    # In-memory TTL cache
  providers/                  # StockProvider abstraction (MockStockProvider & AdobeStockOfficialProvider)
hooks/
  useLocalStorage.ts          # Reactive localStorage hook
  useMoodboards.ts            # Moodboards CRUD and collections manager
  useSearchHistory.ts         # Query history hook (last 20 queries)
  useDebounce.ts              # Value debouncer
  useSettings.ts              # Workspace preferences
types/
  asset.ts                    # Normalized Asset and search parameters
  moodboard.ts                # Moodboards state and export schema
  generator.ts                # Generator item, settings, and prompt models
```

---

## How to Add a New Tool

DOCTORx is designed with a centralized tool registry:

1. **Add an entry in `config/tools.ts`**:
   ```ts
   {
     id: 'keyword-trends',
     name: 'Keyword Trends',
     description: 'Explore historical stock search volumes and seasonality.',
     href: '/keyword-trends',
     iconName: 'TrendingUp',
     status: 'live', // or 'soon'
     category: 'Research',
   }
   ```
2. **Create the page in `app/<tool>/page.tsx`**:
   Use the standard hero pattern (category pill, H1, description) and build the tool's interface.
3. The new tool will automatically appear in:
   - The `/tools` directory catalog.
   - The sidebar's **All Tools** dropdown menu.
