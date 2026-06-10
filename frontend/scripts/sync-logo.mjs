// Pre-dev/build convenience: people naturally drop `main-logo.png` in the
// frontend folder root, but Next.js only serves static files from `public/`.
// If a root copy exists and differs from public/, sync it over so the logo
// "just works" no matter where it was dropped. Silent no-op otherwise.
import { copyFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "main-logo.png");
const dest = join(root, "public", "main-logo.png");

try {
  if (existsSync(src)) {
    const needsCopy =
      !existsSync(dest) || statSync(src).mtimeMs > statSync(dest).mtimeMs;
    if (needsCopy) {
      copyFileSync(src, dest);
      console.log("[sync-logo] copied main-logo.png -> public/main-logo.png");
    }
  }
} catch (err) {
  console.warn("[sync-logo] skipped:", err?.message);
}
