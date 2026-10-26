# Setup Guide

This project is a client-side React + TypeScript app for interactive route planning on a map.

## Requirements

- Node.js 20+ or newer
- npm
- Optional: Docker and Docker Compose

## Local development

1. Open a terminal in the project root.
2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open the app in your browser:

```text
http://localhost:5173
```

## Production build

Build the optimized production files:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview -- --host 0.0.0.0
```

Then open:

```text
http://localhost:4173
```

## Docker setup

### Development with hot reload

```bash
docker compose up app-dev
```

Open:

```text
http://localhost:5173
```

### Production container

```bash
docker compose up --build app-prod
```

Open:

```text
http://localhost:8080
```

To stop the containers:

```bash
docker compose down
```

## Notes

- The app stores route data in the browser using `localStorage`.
- There is no backend database or server-side API required.
- The app is designed to work as a static frontend.
