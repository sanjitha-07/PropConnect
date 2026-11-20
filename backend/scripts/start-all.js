import { spawn } from "child_process";
import path from "path";

const mongodPath = "C:\\Program Files\\MongoDB\\Server\\9.0\\bin\\mongod.exe";
const dbPath = path.resolve("backend/data/db");
const logPath = path.resolve("backend/data/mongod.log");

console.log("Starting mongod...");
const mongodProc = spawn(mongodPath, ["--dbpath", dbPath, "--port", "27017", "--logpath", logPath], { detached: true });

await new Promise((r) => setTimeout(r, 2000));

process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/propconnect_db";
process.env.PORT = "5000";

const { connectMongoDB } = await import("../config/db.js");
await connectMongoDB();

const { seedAllData } = await import("../seed.js");
await seedAllData();

const { app } = await import("../server.js");
console.log("PropConnect backend fully initialized and listening on http://localhost:5000");
