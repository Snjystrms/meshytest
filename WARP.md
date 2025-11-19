# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**Meshy Test Application** - A React/TypeScript application for AI-powered 3D model generation using the Meshy API. The application supports text-to-3D generation, image-to-3D conversion, model refinement, character rigging, and animation workflows.

### Core Technologies
- **Frontend**: React 18, TypeScript, Vite
- **UI Framework**: shadcn/ui components with Radix UI primitives and Tailwind CSS
- **3D Rendering**: Three.js with React Three Fiber and drei for model visualization
- **State Management**: TanStack Query for API state, local storage for job persistence
- **Real-time Updates**: Server-Sent Events (SSE) for progress tracking
- **Proxy Server**: Express.js server for Meshy API proxying and CORS handling

## Architecture

### Client-Server Architecture
The application follows a client-server pattern with:
1. **Frontend** (`src/`) - React SPA handling UI and 3D visualization
2. **Proxy Server** (`server/`) - Express server proxying Meshy API requests and handling CORS

### Data Flow Patterns
- **Job-based workflow**: Each 3D generation task creates a "job" stored in localStorage
- **Real-time progress**: SSE streams provide live updates from Meshy API
- **Fallback polling**: Automatic fallback to REST polling if SSE fails
- **Multi-stage pipeline**: Text → Preview → Refine → Rig → Animate

### Key Components Architecture
- **Pages**: Route-level components (`Index.tsx`, `ImageTo3D.tsx`)
- **Components**: Reusable UI components with specific responsibilities:
  - `PromptForm`: Input handling and validation
  - `JobsList`: Job history and selection
  - `ModelViewer`: Three.js 3D model rendering and animation
  - `ActionBar`: Post-generation actions (refine, rig, animate)
- **Hooks**: Custom React hooks for API integration and state management
- **API Client**: Typed Meshy API client with error handling and proxy support

## Common Development Commands

### Frontend Development
```powershell
# Start development server with HMR
npm run dev

# Build for production
npm run build

# Build for development (includes source maps)
npm run build:dev

# Lint code
npm run lint

# Preview production build
npm run preview
```

### Proxy Server
```powershell
# Start proxy server (from /server directory)
cd server
npm start

# Development mode (same as start)
npm run dev
```

### Running Full Stack
1. Start proxy server: `cd server && npm start` (port 8787)
2. Start frontend: `npm run dev` (port 5173)
3. Set `VITE_USE_PROXY=true` in frontend `.env`

## Environment Configuration

### Frontend (.env)
```
VITE_USE_PROXY=true
VITE_MESHY_BASE_URL=https://api.meshy.ai
VITE_MESHY_API_KEY=msy_... (only if not using proxy)
```

### Server (.env in /server)
```
MESHY_API_KEY=msy_...
MESHY_BASE_URL=https://api.meshy.ai
PORT=8787
```

## Code Organization Patterns

### API Layer (`src/api/meshyClient.ts`)
- Centralized API client with typed interfaces
- Automatic error normalization and subscription detection
- SSE streaming support for real-time updates
- Proxy-aware URL handling for asset delivery

### Storage Layer (`src/lib/storage.ts`)
- localStorage-based job persistence
- Rich job metadata including progress, rigging, and animation status
- Automatic cleanup (keeps last 20 jobs)

### Hook Patterns (`src/hooks/`)
- **API Hooks**: `useTextTo3D`, `useImageTo3D`, `useRigging`, `useAnimation`
- **Streaming Hooks**: `useStreamTextTo3DTask`, `useStreamRiggingTask`
- **Utility Hooks**: `use-toast`, `use-mobile`, job polling

### Component Patterns
- **Form Components**: Use react-hook-form with zod validation
- **3D Components**: Three.js integration via @react-three/fiber
- **UI Components**: shadcn/ui components with consistent styling

## 3D Pipeline Workflow

### Text-to-3D Generation
1. **Preview Mode**: Fast, low-quality preview generation
2. **Refine Mode**: High-quality model with PBR texturing
3. **Real-time Updates**: SSE provides progress updates throughout

### Character Pipeline
1. **Rigging**: Convert static 3D model to rigged character
2. **Animation**: Apply motion to rigged characters
3. **Built-in Animations**: Walking, running animations included with rigging
4. **Custom Animations**: User-specified animations via action IDs

### Asset Management
- **Proxy Support**: All Meshy assets proxied through server for CORS
- **Format Support**: GLB, FBX, OBJ, MTL, USDZ formats
- **Thumbnail Generation**: Automatic preview thumbnails

## File Structure Context

```
src/
├── api/meshyClient.ts        # Meshy API client with SSE support
├── hooks/                    # Custom React hooks for API integration
│   ├── useTextTo3D.ts       # Text-to-3D generation and streaming
│   ├── useImageTo3D.ts      # Image-to-3D conversion
│   ├── useRigging.ts        # Character rigging
│   └── useAnimation.ts      # Animation generation
├── components/              # Reusable UI components
│   ├── PromptForm.tsx       # Text input and generation options
│   ├── JobsList.tsx         # Job history with real-time progress
│   ├── ModelViewer.tsx      # Three.js 3D model visualization
│   └── ActionBar.tsx        # Post-generation actions
├── pages/                   # Route-level components
│   ├── Index.tsx           # Main text-to-3D interface
│   └── ImageTo3D.tsx       # Image-to-3D interface
└── lib/
    ├── storage.ts          # localStorage job persistence
    └── utils.ts           # Utility functions and class merging

server/
└── index.js               # Express proxy server for Meshy API
```

## Development Guidelines

### TypeScript Configuration
- Uses project references with separate configs for app and build tools
- Path aliases configured: `@/*` maps to `src/*`
- Relaxed type checking for rapid development (noImplicitAny: false)

### Styling Approach
- Tailwind CSS with shadcn/ui design system
- CSS variables for theming support
- Responsive design patterns with mobile-first approach

### Error Handling
- Centralized error handling in API client
- Toast notifications for user feedback
- Graceful degradation (SSE → polling fallback)

### Performance Considerations
- TanStack Query for API state management with smart caching
- Three.js performance optimization in ModelViewer
- Lazy loading and code splitting where appropriate

## API Integration Notes

### Meshy API v2 Features
- Text-to-3D with preview/refine modes
- Image-to-3D conversion
- Character rigging and animation
- Real-time progress via SSE streams
- Multiple 3D format exports

### Rate Limiting & Subscriptions
- Free tier limitations automatically detected
- Subscription upgrade prompts with direct links
- Error messages include specific upgrade guidance