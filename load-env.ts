/**
 * Must be imported FIRST from server.ts so process.env is populated before any module
 * that reads GEMINI_API_KEY at load time (e.g. debug logs in gemini.ts).
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// App-local .env (kisanmitra/.env) — primary
const localEnvPath = path.resolve(__dirname, ".env");
dotenv.config({ path: localEnvPath });

// Parent workspace .env (e.g. "kisan mitra/.env") — fallback
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

console.log("[ENV] .env path:", localEnvPath);
console.log(
  "[ENV] GEMINI_API_KEY:",
  process.env.GEMINI_API_KEY
    ? `Found (${process.env.GEMINI_API_KEY.substring(0, 8)}...)`
    : "MISSING"
);
