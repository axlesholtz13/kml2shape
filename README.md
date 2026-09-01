# KML / KMZ → Shapefile Converter

A browser-based, drag-and-drop utility that converts **KML** and **KMZ** (Google Earth) files into zipped **Esri shapefiles**. All parsing and conversion happen **locally in the browser** — your spatial data is never uploaded to a server.

Built for quick GIS workflows (e.g. BC Timber Sales / ArcGIS Pro), where field-collected KML/KMZ needs to be moved into a shapefile-based pipeline.

![status](https://img.shields.io/badge/processing-100%25%20client--side-brightgreen)

## Features

- 🗺️ Drag-and-drop or click-to-browse, **multiple files** at once
- 📦 Automatically extracts the KML document from inside a **KMZ** archive
- 🔺 Converts **point, line, and polygon** features
- 🧩 Separates **mixed geometry** into individual shapefile layers (points / lines / polygons)
- 🔢 Reports feature counts and geometry-type breakdown per file
- ⬇️ Outputs a **ZIP** containing the standard `.shp`, `.shx`, `.dbf`, `.prj` components
- 🔒 **Fully client-side** — no server, no upload

## Tech stack

- [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [jszip](https://stuk.github.io/jszip/) — read KMZ archives
- [@tmcw/togeojson](https://github.com/tmcw/togeojson) — KML → GeoJSON
- [shp-write](https://github.com/mapbox/shp-write) — GeoJSON → shapefile ZIP
- [lucide-react](https://lucide.dev/) — icons

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Run the dev server
npm run dev

# 3. Build for production
npm run build
npm run preview
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

## Usage

1. Open the app in your browser.
2. Drag one or more `.kml` / `.kmz` files onto the drop zone (or click to browse).
3. Wait for each file to show **converted**.
4. Click **Download ZIP** to save the shapefile bundle.
5. Unzip and add the `.shp` to ArcGIS Pro (or QGIS).

## Coordinate system note

KML/KMZ coordinates are geographic **longitude/latitude (WGS 84)**. The output shapefile inherits those geographic coordinates. **Verify or define the coordinate system in ArcGIS Pro** (and project to your operational CRS, e.g. BC Albers / NAD83, if required) before doing measurement or analysis.

## Deploying to GitHub Pages (optional)

1. In `vite.config.js`, set `base: "/<your-repo-name>/"`.
2. Build: `npm run build`.
3. Publish the `dist/` folder to the `gh-pages` branch (e.g. with the [`gh-pages`](https://www.npmjs.com/package/gh-pages) package or a GitHub Action).

## License

MIT — see [`LICENSE`](LICENSE).
