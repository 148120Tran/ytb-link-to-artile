const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const SERVER_PORT = Number(process.env.ELECTRON_SERVER_PORT || 3000);
let serverProcess = null;

function waitForServer(url, timeoutMs = 40000) {
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
        setTimeout(attempt, 300);
      });
    };

    attempt();
  });
}

function startNextServer() {
  const appPath = app.getAppPath();
  const nextBin = path.join(
    appPath,
    "node_modules",
    "next",
    "dist",
    "bin",
    "next"
  );
  const nextCommand = app.isPackaged ? "start" : "dev";

  serverProcess = spawn(
    process.execPath,
    ["--runAsNode", nextBin, nextCommand, "-p", String(SERVER_PORT)],
    {
      cwd: appPath,
      env: {
        ...process.env,
        NODE_ENV: app.isPackaged ? "production" : "development",
        PORT: String(SERVER_PORT),
      },
      stdio: "inherit",
    }
  );

  serverProcess.on("exit", (code) => {
    if (code && code !== 0) {
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

  const url = `http://localhost:${SERVER_PORT}`;
  await waitForServer(url);
  await mainWindow.loadURL(url);
}

app.whenReady().then(async () => {
  startNextServer();
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
