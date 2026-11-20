import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const ARTIFACT_DIR = "C:\\Users\\Siva\\.gemini\\antigravity\\brain\\80852ab2-21b7-44f8-aacd-f9e765532548";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT_FRONTEND = 5175;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendCDP(ws, method, params = {}) {
  const id = Math.floor(Math.random() * 1000000);
  return new Promise((resolve, reject) => {
    const handler = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id === id) {
          ws.removeEventListener("message", handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      } catch (err) {}
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function captureScreenshot(ws, filename) {
  const result = await sendCDP(ws, "Page.captureScreenshot", { format: "png" });
  const buffer = Buffer.from(result.data, "base64");
  const filePath = path.join(ARTIFACT_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  console.log(`📸 Saved screenshot: ${filePath} (${(buffer.length / 1024).toFixed(1)} KB)`);
  return filePath;
}

async function run() {
  console.log("=== CAPTURING FINAL LANDLORD PORTAL QA SCREENSHOTS ===");

  // Start Headless Chrome with Remote Debugging
  const userDataDir = path.resolve("backend/data/chrome-profile-" + Date.now());
  const chromeProc = spawn(CHROME_PATH, [
    "--headless=new",
    "--remote-debugging-port=9222",
    `--user-data-dir=${userDataDir}`,
    "--window-size=1400,900",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `http://localhost:${PORT_FRONTEND}/landlord`,
  ]);
  await sleep(3000);

  try {
    const versionRes = await fetch("http://127.0.0.1:9222/json");
    const targets = await versionRes.json();
    const pageTarget = targets.find((t) => t.type === "page") || targets[0];
    if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
      throw new Error("Could not find Chrome webSocketDebuggerUrl: " + JSON.stringify(targets));
    }

    console.log("Connecting to Chrome CDP at:", pageTarget.webSocketDebuggerUrl);
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.addEventListener("open", resolve));

    await sendCDP(ws, "Page.enable");
    await sendCDP(ws, "Runtime.enable");
    await sendCDP(ws, "DOM.enable");

    // Inject landlord auth token and user
    console.log("Injecting Landlord credentials into localStorage...");
    await sendCDP(ws, "Runtime.evaluate", {
      expression: `
        localStorage.setItem("pc-user", JSON.stringify({
          id: "LDL_USER_001",
          email: "karthik.raja@mail.com",
          role: "landlord",
          name: "Karthik Raja",
          entityId: "LDL001"
        }));
        localStorage.setItem("pc-token", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IkxETF9VU0VSXzAwMSIsIl9pZCI6IkxETF9VU0VSXzAwMSIsImVtYWlsIjoia2FydGhpay5yYWphQG1haWwuY29tIiwibmFtZSI6IkthcnRoaWsgUmFqYSIsInJvbGUiOiJsYW5kbG9yZCIsImVudGl0eUlkIjoiTERMMDAxIiwiZW50aXR5X2lkIjoiTERMMDAxIiwiaWF0IjoxNzk1MDk3MTY1LCJleHAiOjE3OTUxODM1NjV9.XmNG7TGcOzKFTugY8G4mm6EdmE4_BS8OKAEbj3Tl4Uo");
      `,
    });

    // 1. Dashboard screenshot (/landlord)
    console.log("Navigating to /landlord...");
    await sendCDP(ws, "Page.navigate", { url: `http://localhost:${PORT_FRONTEND}/landlord` });
    await sleep(2500);
    await captureScreenshot(ws, "final_qa_landlord_dashboard.png");

    // 2. Financial Management Hub (/landlord/financials)
    console.log("Navigating to /landlord/financials...");
    await sendCDP(ws, "Page.navigate", { url: `http://localhost:${PORT_FRONTEND}/landlord/financials` });
    await sleep(2000);
    await captureScreenshot(ws, "final_qa_financial_center.png");

    // 3. Maintenance & Requests Hub (/landlord/requests)
    console.log("Navigating to /landlord/requests...");
    await sendCDP(ws, "Page.navigate", { url: `http://localhost:${PORT_FRONTEND}/landlord/requests` });
    await sleep(2000);
    await captureScreenshot(ws, "final_qa_requests_center.png");

    // 4. Property Management Hub (/landlord/properties)
    console.log("Navigating to /landlord/properties...");
    await sendCDP(ws, "Page.navigate", { url: `http://localhost:${PORT_FRONTEND}/landlord/properties` });
    await sleep(2000);
    await captureScreenshot(ws, "final_qa_properties_catalog.png");

    // 5. Tenants & Leases Accordion Interaction
    console.log("Opening Tenants & Leases accordion and navigating to /landlord/tenants...");
    await sendCDP(ws, "Page.navigate", { url: `http://localhost:${PORT_FRONTEND}/landlord/tenants` });
    await sleep(2000);
    await captureScreenshot(ws, "final_qa_tenants_leases.png");

    // 6. Mobile Viewport (390x844 iPhone 12/14/15 size)
    console.log("Emulating Mobile Viewport (390x844)...");
    await sendCDP(ws, "Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sendCDP(ws, "Page.navigate", { url: `http://localhost:${PORT_FRONTEND}/landlord` });
    await sleep(2000);
    await captureScreenshot(ws, "final_qa_mobile_responsive.png");

    console.log("✅ All final QA screenshots captured successfully!");
    ws.close();
  } catch (err) {
    console.error("Screenshot capture error:", err);
  } finally {
    try {
      chromeProc.kill();
    } catch {}
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }
}

run();
