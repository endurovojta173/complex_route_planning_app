# Instructions for AI Agents (agents.md)

## Project Description
A client-side web application for interactive drawing and route planning on a map, created by **Vojtěch Břenek** (aka **endurovojta173**) to solve complex route and logistics planning for a local folk event. It allows manual drawing, route branching with vertex snapping, and local data storage directly in the browser.

## Tech Stack
- **Frontend:** React 19 + TypeScript 6 + Vite 8
- **Map:** Leaflet 1.9 + react-leaflet 5
- **Drawing:** @geoman-io/leaflet-geoman-free 2.20
- **Icons:** Lucide React
- **Storage:** `localStorage` (GeoJSON format)
- **Containerization:** Docker (multi-stage) + Docker Compose
- **Deployment:** GitHub Pages (via GitHub Actions) / Docker Nginx container

## Architecture and Data Handling
- **Persistence:** Drawn layers are exported to GeoJSON (`layer.toGeoJSON()`) after every change and stored as a string via `JSON.stringify` in `localStorage`. Upon app load, data is retrieved from the local cache and rendered using `L.geoJSON()`.
- **Static Application:** Do not add any backend, database, or server-side logic. The application runs entirely on the client side.

## Docker Setup & Workflow

The application includes a multi-stage `Dockerfile` and `docker-compose.yml` supporting both live local development and optimized production serving:

### 1. Docker Compose (Recommended)
- **Development with Hot Reloading (HMR):**
  ```bash
  docker compose up app-dev
  ```
  Accessible at [http://localhost:5173](http://localhost:5173). Changes in `src/` are hot-reloaded automatically.

- **Production Environment (Nginx):**
  ```bash
  docker compose up --build app-prod
  ```
  Accessible at [http://localhost:8080](http://localhost:8080). Builds the production assets and serves them via an optimized Nginx Alpine instance.

- **Stop containers:**
  ```bash
  docker compose down
  ```

### 2. Standalone Docker CLI Commands
- **Build & Run Production Image:**
  ```bash
  docker build -t route-planner:latest .
  docker run -d -p 8080:80 --name route_planner_prod route-planner:latest
  ```

- **Build & Run Development Image:**
  ```bash
  docker build --target dev -t route-planner:dev .
  docker run -p 5173:5173 -v $(pwd):/app -v /app/node_modules --name route_planner_dev route-planner:dev
  ```

### 3. Docker Configuration Files
- **`Dockerfile`:** 4-stage build (`base`, `dev`, `builder`, `production`) with built-in healthcheck (`/healthz`).
- **`docker-compose.yml`:** Defines `app-dev` (port 5173) and `app-prod` (port 8080).
- **`nginx.conf`:** Production Nginx config featuring SPA fallback (`try_files`), gzip compression, asset caching headers, and security headers.
- **`.dockerignore`:** Excludes `node_modules`, `dist`, `.git`, and local cache files from the build context.

## Development Rules
- Maintain strict TypeScript and typing.
- Use modern functional components and React hooks.
- Ensure proper cleanup of map instances (Leaflet) and drawing tools (Geoman) inside `useEffect` to prevent memory leaks and duplication of overlay layers during re-renders.
- **Base URL Setting:** In `vite.config.ts`, `base` is configured to use `process.env.BASE_PATH` or fallback to `/complex_route_planning_app/` if `GITHUB_ACTIONS` is set, and `'/'` for Docker or standard local dev.
