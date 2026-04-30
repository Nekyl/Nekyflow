# Nekyflow

A sleek streaming-style web interface for discovering and watching movies and TV shows, powered by the TMDB API and embedded players.

<p align="center">
  <a href="#english">English</a> | <a href="README.pt.md#português">Português</a>
</p>

## Features

- **Browse** trending movies, TV series, animations, and more
- **Genre filtering** for movies and TV shows
- **Search** across movies, TV shows, and people
- **Favorites & Watchlist** with local storage persistence
- **Watch history** tracking
- **Detail modals** with cast, recommendations, and similar titles
- **Built-in player** with HLS streaming and subtitle support
- **Responsive design** — works on desktop and mobile
- **PWA-ready** with service worker for offline support
- **No build step** — just open and run

## Setup

1. Clone or download this repository
2. Copy `.env.example` to `.env` in the project root and paste your TMDB API key:

```bash
cp .env.example .env
```

Then edit `.env` and paste your key:

```
TMDB_API_KEY=your_api_key_here
```

You can get a free API key at [themoviedb.org/settings/api](https://www.themoviedb.org/terms-of-use).

## Running

### Option 1: Open directly (no server needed)

Simply open `index.html` in your browser:

```
# macOS
open index.html

# Linux
xdg-open index.html
```

### Option 2: Local HTTP server

If you prefer to serve it over HTTP:

```bash
python3 -m http.server 8080 --bind 0.0.0.0
```

Then visit `http://localhost:8080`.

## Project Structure

```
Nekyflow/
├── index.html          # Main entry point
├── .env                # TMDB API key
├── sw.js               # Service worker (PWA)
├── css/
│   └── style.css       # All styles
└── js/
    ├── api.js          # TMDB API wrapper with caching
    ├── app.js          # Main application logic
    ├── config.js       # Configuration
    ├── player.js       # HLS video player
    └── ui.js           # Carousel and UI components
```

## Technologies

- **Vanilla JavaScript** — no frameworks
- **HLS.js** — video streaming
- **TMDB API** — movie/TV metadata and images
- **StreamIMDB** — embedded video playback

## License

This project is for personal use only. TMDB data and images are subject to [TMDB Terms of Use](https://www.themoviedb.org/terms-of-use).
