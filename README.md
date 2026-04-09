# Newton Wildfire Watch

Real-time wildfire detection dashboard powered by [Newton](https://www.archetypeai.dev/) and the [ALERTCalifornia](https://alertcalifornia.org/) camera network.

Monitors 1,200+ wildfire cameras across California, focused on 5 major fire zones from recent devastating wildfires. Newton analyzes live camera frames for smoke, fire, haze, and visibility changes.

## Fire Zones

| Zone | Fire | Year | Acres | County |
|------|------|------|-------|--------|
| Palisades | Palisades Fire | Jan 2025 | 23,448 | Los Angeles |
| Eaton | Eaton Fire | Jan 2025 | 14,021 | Los Angeles |
| Park | Park Fire | Jul 2024 | 429,603 | Butte / Tehama |
| Thompson | Thompson Fire | Jul 2024 | 3,000+ | Butte |
| Smith | Smith Fire | Feb 2025 | 700+ | San Diego |

## Features

- **Multi-camera grid** — browse up to 12 cameras per fire zone with auto-refreshing thumbnails (15s)
- **Full-frame viewer** — selected camera at full resolution with status overlay
- **Automatic analysis** — Newton analyzes frames every 10 seconds for smoke, fire, haze indicators
- **Risk classification** — Clear / Watch / Danger labels based on Newton's assessment
- **Interactive chat** — ask Newton questions about what it sees
- **Zone switching** — switch between 5 fire zones to monitor different regions

## Stack

- **SvelteKit** with Svelte 5 runes
- **Archetype AI Design System** — semantic tokens, component primitives, composite patterns
- **Newton API** — vision model via lens/session API
- **ALERTCalifornia** — public camera data (JPEG snapshots, no auth required)
- **Tailwind v4** — styling with semantic design tokens

## Setup

```bash
npm install
```

Create a `.env` file:

```
ATAI_API_KEY=your_api_key_here
ATAI_API_ENDPOINT=https://api.u1.archetypeai.app/
```

## Development

```bash
npm run dev
```

Open `http://localhost:5173`, select a fire zone, then click **Start Analysis**.

## How It Works

1. Select a fire zone — cameras near that zone load from the ALERTCalifornia API
2. Click a camera thumbnail to view it full-size
3. **Start Analysis** creates a Newton lens session
4. Every 10 seconds, the server fetches the selected camera's latest JPEG, converts to base64, and sends to Newton
5. Newton returns a wildfire risk assessment displayed in the Analysis panel
6. Chat lets you ask specific questions about the current camera frame
