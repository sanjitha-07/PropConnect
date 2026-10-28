import { execSync } from "child_process";

const PORT = process.env.PORT || 5000;

function freePort(port) {
  try {
    if (process.platform === "win32") {
      const output = execSync(`netstat -ano -p tcp`, { encoding: "utf8" });
      const lines = output.split("\n");
      const pidsToKill = new Set();

      for (const line of lines) {
        if (line.includes(`:${port}`) && line.includes("LISTENING")) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== "0" && pid !== String(process.pid)) {
            pidsToKill.add(pid);
          }
        }
      }

      for (const pid of pidsToKill) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
          console.log(`🧹 Port ${port} was occupied by PID ${pid}. Process terminated successfully.`);
        } catch {
          // Process might already be gone
        }
      }
    } else {
      try {
        execSync(`lsof -ti :${port} | xargs kill -9`, { stdio: "ignore" });
      } catch {}
    }
  } catch {
    // Port is free
  }
}

freePort(PORT);
