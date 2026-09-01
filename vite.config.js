import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// If you deploy to GitHub Pages under https://<user>.github.io/<repo>/,
// set base to "/<repo>/". For a user/root site or local dev, keep "/".
export default defineConfig({
  plugins: [react()],
  base: "/axlesholtz13/kml2shape",
});
