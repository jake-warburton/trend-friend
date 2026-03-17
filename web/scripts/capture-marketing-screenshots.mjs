import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(__dirname, "..");
const OUTPUT_DIR = join(WEB_ROOT, "public", "screenshots");
const HOST = "127.0.0.1";
const PORT = process.env.SCREENSHOT_PORT ?? "3101";
const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? `http://${HOST}:${PORT}`;
const THEME_COOKIE = "signal_eye_theme";
const DEFAULT_TIMEOUT_MS = 60_000;

const THEMES = [
  {
    key: "tech-light",
    suffix: "light",
    colorScheme: "light",
  },
  {
    key: "soft-charcoal",
    suffix: "dark",
    colorScheme: "dark",
  },
];

const SHOTS = [
  {
    name: "explorer",
    path: "/explore?screenshot=1",
    viewport: { width: 1440, height: 1024 },
    waitFor: '[data-screenshot-target="explore"] .content-grid .ranking-panel',
    capture: "page",
    settleDelayMs: 1000,
  },
  {
    name: "trend-detail",
    path: "/trends/ai-agents?screenshot=1",
    viewport: { width: 1440, height: 1080 },
    waitFor: '[data-screenshot-target="trend-detail"] .chart-container svg',
    capture: "page",
    settleDelayMs: 1000,
  },
  {
    name: "ad-intelligence",
    path: "/ad-intelligence?screenshot=1",
    viewport: { width: 1440, height: 1080 },
    waitFor: ".adi-wrap .adi-table",
    capture: "page",
    settleDelayMs: 1500,
  },
  {
    name: "social-intelligence",
    path: "/social-intelligence?screenshot=1",
    viewport: { width: 1440, height: 1080 },
    waitFor: ".social-intel-wrap",
    capture: "page",
    settleDelayMs: 1500,
  },
];

const MANIFEST_FILE = join(OUTPUT_DIR, "manifest.json");

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const externalServer = await isServerRunning(`${BASE_URL}/`);
  const server = externalServer ? null : startDevServer();

  const timestamp = Date.now();
  const manifest = {};

  try {
    await waitForServer(`${BASE_URL}/`);
    const browser = await chromium.launch({ headless: true });

    try {
      for (const theme of THEMES) {
        for (const shot of SHOTS) {
          const fileName = await captureShot(browser, shot, theme, timestamp);
          const key = `${shot.name}-${theme.suffix}`;
          manifest[key] = `/screenshots/${fileName}`;
        }
      }
    } finally {
      await browser.close();
    }

    await removeStaleScreenshots(timestamp);
    await writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`Wrote manifest to ${MANIFEST_FILE}`);
  } finally {
    if (server) await stopServer(server);
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: WEB_ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function startDevServer() {
  const child = spawn(
    "npm",
    ["run", "dev", "--", "--hostname", HOST, "--port", PORT],
    {
      cwd: WEB_ROOT,
      env: {
        ...process.env,
        NEXT_PUBLIC_APP_URL: BASE_URL,
        SCREENSHOT_BYPASS_AUTH: "1",
      },
      stdio: "inherit",
      shell: process.platform === "win32",
      detached: true,
    },
  );
  process.on("exit", () => {
    killProcessGroup(child);
  });
  return child;
}

function killProcessGroup(child, signal = "SIGTERM") {
  try {
    process.kill(-child.pid, signal);
  } catch {
    // process group already gone
  }
}

async function isServerRunning(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < DEFAULT_TIMEOUT_MS) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // keep polling
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function captureShot(browser, shot, theme, timestamp) {
  const fileName = `${shot.name}-${theme.suffix}-${timestamp}.png`;
  console.log(`Capturing ${fileName} from ${shot.path}`);
  const context = await browser.newContext({
    viewport: shot.viewport,
    colorScheme: theme.colorScheme,
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  });

  try {
    await context.addCookies([
      {
        name: THEME_COOKIE,
        value: theme.key,
        domain: HOST,
        path: "/",
      },
    ]);
    const page = await context.newPage();
    page.setDefaultTimeout(DEFAULT_TIMEOUT_MS);
    await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: "networkidle" });
    await page.addStyleTag({
      content: `
        *,
        *::before,
        *::after {
          animation: none !important;
          transition: none !important;
          scroll-behavior: auto !important;
          caret-color: transparent !important;
        }
      `,
    });
    await page.locator(shot.waitFor).first().waitFor({ state: "visible" });
    if (shot.scrollTo) {
      const locator = page.locator(shot.scrollTo).first();
      await locator.scrollIntoViewIfNeeded();
      if (shot.scrollOffset) {
        const box = await locator.boundingBox();
        if (box) {
          await page.evaluate(
            ({ top, offset }) => window.scrollTo(0, Math.max(0, top + window.scrollY + offset)),
            { top: box.y, offset: shot.scrollOffset },
          );
        }
      }
      await delay(300);
    } else {
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    if (shot.settleDelayMs) {
      await delay(shot.settleDelayMs);
    }

    const outputPath = join(OUTPUT_DIR, fileName);
    if (shot.capture === "locator" && shot.selector) {
      await page.locator(shot.selector).screenshot({
        path: outputPath,
      });
      return fileName;
    }

    await page.screenshot({
      path: outputPath,
      fullPage: false,
    });

    return fileName;
  } finally {
    await context.close();
  }
}

async function removeStaleScreenshots(currentTimestamp) {
  const files = await readdir(OUTPUT_DIR);
  const timestampPattern = /^(.+)-(\d+)\.png$/;
  for (const file of files) {
    const match = file.match(timestampPattern);
    if (match && match[2] !== String(currentTimestamp)) {
      await unlink(join(OUTPUT_DIR, file));
      console.log(`Removed stale screenshot: ${file}`);
    }
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopServer(server) {
  if (server.exitCode != null) {
    return;
  }

  killProcessGroup(server, "SIGTERM");
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    delay(5_000).then(() => {
      if (server.exitCode == null) {
        killProcessGroup(server, "SIGKILL");
      }
    }),
  ]);
}

main().then(() => {
  console.log("Done.");
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
