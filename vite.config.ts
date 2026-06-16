// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    optimizeDeps: {
      // Pre-bundle browser dependencies that otherwise get discovered after the
      // first page load, which can leave stale optimized chunk hashes in preview.
      include: ["@supabase/supabase-js", "zustand", "zustand/middleware"],
      // The Lovable preview can keep a tab alive while Vite refreshes its
      // optimized dependency cache. Without this, Vite rejects requests that
      // still carry the previous browser hash, returning 504 for valid chunks.
      ignoreOutdatedRequests: true,
    },
  },
});
