const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const SERVER_PORT = Number(process.env.ELECTRON_SERVER_PORT || 3000);
let serverProcess = null;

// ---------------------------------------------------------------------------
// User config — lives at %APPDATA%/Gemini Article/config.json (or OS equiv.)
// Users edit this file to set TARGET_API_URL, GEMINI_MODEL, etc.
// ---------------------------------------------------------------------------
const CONFIG_DEFAULTS = {
  TARGET_API_URL: "",
  GEMINI_API_KEY: "",
  GEMINI_MODEL: "gemini-1.5-flash-latest",
  SAMPLE_IMAGE_URL: "",
  LIVEWIRE_PAGE_URL: "",
  LIVEWIRE_COMPONENT_NAME: "",
  LIVEWIRE_COOKIE: "",
};

function loadUserConfig() {
  const configPath = path.join(app.getPath("userData"), "config.json");

  if (!fs.existsSync(configPath)) {
    // Write a template on first launch so the user knows what to fill in.
    fs.writeFileSync(
      configPath,
      JSON.stringify(CONFIG_DEFAULTS, null, 2),
      "utf8"
    );
    console.log("Created default config at", configPath);
    return { ...CONFIG_DEFAULTS };
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return { ...CONFIG_DEFAULTS, ...JSON.parse(raw) };
  } catch (err) {
    console.error("Could not parse config.json:", err.message);
    return { ...CONFIG_DEFAULTS };
  }
}

// ---------------------------------------------------------------------------
// Server helpers
// ---------------------------------------------------------------------------
function waitForServer(url, timeoutMs = 60000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error("Next.js server failed to start in time."));
          return;
        }
        setTimeout(attempt, 500);
      });
    };

    attempt();
  });
}

function startNextServer(userConfig) {
  const appPath = app.getAppPath();

  // Merge user config values into the env for the child process.
  const extraEnv = {};
  for (const [key, value] of Object.entries(userConfig)) {
    if (value && String(value).trim()) {
      extraEnv[key] = String(value).trim();
    }
  }

  if (app.isPackaged) {
    // Production: use the self-contained standalone server produced by
    // `next build` with output:"standalone".  static + public assets were
    // copied into the standalone directory by scripts/prepare-electron.mjs.
    const standaloneDir = path.join(appPath, ".next", "standalone");
    const serverScript = path.join(standaloneDir, "server.js");

    serverProcess = spawn(process.execPath, [serverScript], {
      cwd: standaloneDir,
      env: {
        ...process.env,
        ...extraEnv,
        ELECTRON_RUN_AS_NODE: "1",
        NODE_ENV: "production",
        PORT: String(SERVER_PORT),
        HOSTNAME: "127.0.0.1",
      },
      stdio: "inherit",
    });
  } else {
    // Development: use `next dev` from the project root.
    const nextBin = path.join(
      appPath,
      "node_modules",
      "next",
      "dist",
      "bin",
      "next"
    );

    serverProcess = spawn(process.execPath, [nextBin, "dev", "-p", String(SERVER_PORT)], {
        cwd: appPath,
        env: {
          ...process.env,
          ...extraEnv,
          ELECTRON_RUN_AS_NODE: "1",
          NODE_ENV: "development",
          PORT: String(SERVER_PORT),
        },
        stdio: "inherit",
      }
    );
  }

  serverProcess.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error("Next.js server exited with code", code);
    }
  });
}

async function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    backgroundColor: "#0b0f1a",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const serverUrl = `http://localhost:${SERVER_PORT}`;

  try {
    await waitForServer(serverUrl);
  } catch (err) {
    const configPath = path.join(app.getPath("userData"), "config.json");
    dialog.showErrorBox(
      "Server failed to start",
      `The Next.js server did not respond within the timeout period.\n\n` +
        `${err.message}\n\n` +
        `Configuration file: ${configPath}`
    );
    app.quit();
    return;
  }

  await mainWindow.loadURL(serverUrl);
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(async () => {
  const userConfig = loadUserConfig();
  startNextServer(userConfig);
  await createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
