# Open Screener

A real-time stock screener with technical analysis, built with modern web technologies.

![Open Screener](https://img.shields.io/badge/Bun-1.0+-black?style=flat-square&logo=bun)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

## Features

- **18+ Pre-built Screens** organized by category:
  - **Technical Signals**: RSI Oversold/Overbought, MACD Bullish
  - **Moving Averages**: Golden Cross, Death Cross, SMA trends
  - **Price & Volume**: Top Gainers/Losers, Volume Spikes, Breakouts
  - **Momentum**: Bullish/Bearish trends, Uptrend/Downtrend
- **Custom Filter Builder**: Create your own screens with multiple conditions
- **Real-time Updates**: WebSocket-powered live data
- **Technical Indicators**: RSI, SMA (20/50/200), EMA (12/26), MACD

## Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS, shadcn/ui, TanStack Query/Table
- **Backend**: Bun, Hono, WebSocket
- **Data**: Polygon.io API
- **Cache**: Redis (optional)

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- [Polygon.io API Key](https://polygon.io/) (free tier works)

### Local Development

```bash
# Install dependencies
bun install

# Set up environment
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env and add your MASSIVE_API_KEY

# Run development servers
bun run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

### Docker (Production)

```bash
# Build the image
docker build -t open-screener .

# Run the container
docker run -p 3001:3001 \
  -e MASSIVE_API_KEY=your_polygon_api_key \
  -e NODE_ENV=production \
  open-screener
```

App available at: http://localhost:3001

## Deploy to Railway

### One-Click Deploy

1. Fork this repository
2. Create a new project on [Railway](https://railway.app/)
3. Select "Deploy from GitHub repo"
4. Connect your forked repository
5. Add environment variables in Railway dashboard:
   - `MASSIVE_API_KEY` - Your Polygon.io API key
6. Click Deploy!

Railway will automatically detect the `Dockerfile` and `railway.toml` configuration.

### Manual Deploy

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Set environment variables
railway variables set MASSIVE_API_KEY=your_key
railway variables set NODE_ENV=production

# Deploy
railway up
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MASSIVE_API_KEY` | Yes | - | Polygon.io API key |
| `PORT` | No | `3001` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `REDIS_URL` | No | - | Redis URL for caching (improves performance) |

## Project Structure

```
├── apps/
│   ├── api/              # Bun + Hono backend
│   │   ├── src/
│   │   │   ├── clients/  # External API clients
│   │   │   ├── routes/   # API endpoints
│   │   │   └── services/ # Business logic
│   │   └── public/       # Static files (production)
│   └── web/              # React + Vite frontend
│       └── src/
│           ├── components/
│           └── hooks/
├── packages/
│   └── shared/           # Shared TypeScript types
├── Dockerfile            # Production container
├── railway.toml          # Railway config
└── docker-compose.yml    # Local development (optional)
```

## API Endpoints

### Screener
- `GET /api/screener/presets` - List all preset filters
- `GET /api/screener/preset/:presetId` - Run a preset filter
- `POST /api/screener/run` - Run custom filter

### Tickers
- `GET /api/tickers` - List all tickers
- `GET /api/tickers/:symbol` - Get ticker details

### Indicators
- `GET /api/indicators/:symbol` - Get indicators for a symbol
- `POST /api/indicators/batch` - Batch fetch indicators

### WebSocket
- `ws://host/ws` - Real-time updates

### Health
- `GET /health` - Health check endpoint

## License

MIT
