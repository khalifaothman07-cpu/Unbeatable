import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  /* The game is served from kaz6-site/games/luluaa/ on the KAZ6 domain,
     so every asset URL has to be relative to that path, not the root. */
  base: "/games/luluaa/",
  build: {
    /* Output straight into the site, where it is COMMITTED alongside the
       other three games. Netlify serves it as static files and never
       rebuilds it — so a broken game build can never block a site deploy. */
    outDir: "../../kaz6-site/games/luluaa",
    emptyOutDir: true,
  },
});
