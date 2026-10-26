# CRP — Complex Route Planning App

A modern, high-performance client-side web application for interactive map drawing, route branching, and local persistence directly in the browser.

Built with **React 19**, **TypeScript 6**, **Vite 8**, **Leaflet**, and **Geoman**.

---

## 📖 Origin & Creator

Created by **Vojtěch Břenek** (aka [endurovojta173](https://github.com/endurovojta173)).

This tool was designed and developed to solve a complex route planning and coordination challenge for our **local traditional folk event**. Managing event parades, logistics, supply points, alternate branches, and assembly zones required an intuitive, map-centric planner that could branch routes with vertex-snapping, run entirely in the browser without servers or databases, and preserve work safely in local storage.

---

## ✨ Features

- **Interactive Drawing Engine:** Draw polylines, polygons, markers, and shapes with Leaflet and Geoman.
- **Route Branching & Snapping:** Automatic vertex snapping allows branching from existing routes, loops, and intersections with zero gap.
- **Multi-Map Local Cache:** Save, name, duplicate, switch between, and manage multiple independent routes and event maps directly in browser `localStorage`.
- **Pure Client-Side Persistence:** Automatically saves routes and features in GeoJSON format to `localStorage`. No backend or database required.
- **Multi-Basemap Support:** Switch seamlessly between OpenStreetMap Standard and Esri Satellite.
- **Route Analytics:** Real-time distance measurement (km / mi), waypoint tracking, and shape counters.
- **GeoJSON Import & Export:** Export your route data to `.geojson` files or import existing GeoJSON collections.
- **Location Search & Autocomplete:** Real-time geocoding search powered by OpenStreetMap Nominatim with smooth animated fly-to centering and location highlight pins.
- **Docker-Only Ready:** Multi-stage `Dockerfile` and `docker-compose.yml` allowing you to run and develop the entire application using only Docker—no Node.js or npm installation required.

---

## 🛠️ Tech Stack

- **Frontend:** [React 19](https://react.dev/) + [TypeScript 6](https://www.typescriptlang.org/) + [Vite 8](https://vite.dev/)
- **Map Rendering:** [Leaflet 1.9](https://leafletjs.com/) + [React-Leaflet 5](https://react-leaflet.js.org/)
- **Drawing Tools:** [@geoman-io/leaflet-geoman-free 2.20](https://geoman.io/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Styling:** Modern Vanilla CSS Design Tokens (Glassmorphism, Dark Mode)
- **Containerization:** Docker + Docker Compose + Nginx Alpine
- **CI/CD Deployment:** GitHub Pages via GitHub Actions

---

## 🐳 Running Locally Only on Docker

You **do not need Node.js or npm installed on your machine** to run or develop this application. Docker and Docker Compose are all that is required.

### 1. Development Mode (Live Hot Reloading)

Run the dev container with live Hot Module Replacement (HMR):

```bash
docker compose up app-dev
```

- Open **[http://localhost:5173](http://localhost:5173)** in your browser.
- Edit any files inside `src/` and changes will immediately reflect in your browser without restarting the container.

### 2. Production Mode (Optimized Nginx Container)

Run the production-grade static build served via a lightweight Nginx Alpine instance:

```bash
docker compose up --build app-prod
```

- Open **[http://localhost:8080](http://localhost:8080)** in your browser.
- Serves the compiled, minified bundle with gzip compression and caching enabled.

### 3. Stopping the Application

To shut down and remove the running containers:

```bash
docker compose down
```

---

### Alternative: Standalone Docker CLI (Without Docker Compose)

If you prefer using direct Docker commands:

- **Run in Development Mode:**
  ```bash
  docker build --target dev -t route-planner:dev .
  docker run -it --rm -p 5173:5173 -v $(pwd):/app -v /app/node_modules --name route_planner_dev route-planner:dev
  ```

- **Run in Production Mode:**
  ```bash
  docker build -t route-planner:latest .
  docker run -d --rm -p 8080:80 --name route_planner_prod route-planner:latest
  ```

---

## 💻 Optional: Local Node.js Development (Without Docker)

If you already have Node.js (v20+) and npm installed and prefer running natively:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the local Vite development server:
   ```bash
   npm run dev
   ```

3. Open **[http://localhost:5173](http://localhost:5173)** in your browser.

4. Build production bundle:
   ```bash
   npm run build
   ```

---

## 🌐 GitHub Pages Deployment

A GitHub Actions workflow is provided in `.github/workflows/deploy.yml`. When pushing to `main` or `master`, the workflow automatically builds and deploys the static application to GitHub Pages.
