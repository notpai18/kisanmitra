import "./load-env.js";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { geminiService } from "./server/services/GeminiService.js";

const AI_UNAVAILABLE = {
  error: true as const,
  message: "AI service unavailable. Please try again.",
};

async function startServer() {
  const app = express();
  const PORT = 3001;

  app.use(express.json({ limit: "10mb" }));

  // ─── Advisory ────────────────────────────────────────────────────
  app.post("/api/advisory", async (req, res) => {
    try {
      const text = await geminiService.generateAdvisory(req.body);
      res.json({ text });
    } catch (error) {
      console.error("Error generating advisory:", error);
      res.status(503).json({ ...AI_UNAVAILABLE });
    }
  });

  // ─── Crop Doctor ─────────────────────────────────────────────────
  app.post("/api/crop-doctor", async (req, res) => {
    try {
      const { image, cropType, language, state, district } = req.body;

      if (!image || !cropType) {
        return res.status(400).json({ error: true, message: "Image and cropType are required" });
      }
      if (!state || !district) {
        return res.status(400).json({ error: true, message: "state and district are required" });
      }

      const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ error: true, message: "Invalid image format" });
      }
      const mimeType = matches[1].includes("png") ? "image/png" : "image/jpeg";
      const imageBase64 = matches[2];

      const data = await geminiService.analyzeCropImage({ imageBase64, mimeType, cropType, language, state, district });
      
      const treatment = Array.isArray(data.treatment_steps) ? data.treatment_steps.map(String) : [];
      const prevention = Array.isArray(data.prevention_tips) ? data.prevention_tips.map(String) : [];
      
      res.json({
        disease_name: String(data.disease_name ?? "Unknown"),
        confidence_percent: Number(data.confidence_percent ?? 0),
        severity: ["Low", "Medium", "High"].includes(String(data.severity)) ? data.severity : "Medium",
        cause: String(data.cause ?? ""),
        treatment_steps: treatment.length ? treatment : ["—", "—", "—", "—"],
        prevention_tips: prevention.length ? prevention : ["—", "—", "—"],
        is_healthy: Boolean(data.is_healthy),
      });
    } catch (error) {
      console.error("Error analyzing crop image:", error);
      res.status(503).json({ ...AI_UNAVAILABLE });
    }
  });

  // ─── Price Predict ───────────────────────────────────────────────
  app.post("/api/price-predict", async (req, res) => {
    try {
      const data = await geminiService.predictPrice(req.body);
      res.json(data);
    } catch (error) {
      console.error("Error predicting price:", error);
      res.status(503).json({ ...AI_UNAVAILABLE });
    }
  });

  // ─── Crop Plan ───────────────────────────────────────────────────
  app.post("/api/crop-plan", async (req, res) => {
    try {
      const data = await geminiService.suggestCropPlan(req.body);
      res.json(data);
    } catch (error) {
      console.error("Error planning crop:", error);
      res.status(503).json({ ...AI_UNAVAILABLE });
    }
  });

  // ─── Scheme Finder ───────────────────────────────────────────────
  app.post("/api/scheme-finder", async (req, res) => {
    try {
      const data = await geminiService.findSchemes(req.body);
      res.json(data);
    } catch (error) {
      console.error("Error finding schemes:", error);
      res.status(503).json({ ...AI_UNAVAILABLE });
    }
  });

  // ─── Test Gemini Config ──────────────────────────────────────────
  app.get("/api/test-gemini", async (req, res) => {
    try {
      // Just do a basic test using the shared service logic, e.g. an advisory:
      const text = await geminiService.generateAdvisory({
        crop: "wheat", acres: 1, soil: "loamy", district: "Varanasi", state: "Uttar Pradesh", temp: 25, humidity: 40, rainChance: 0, date: new Date().toISOString(), question: "Test connection reply with exact the word: success.", language: "en"
      });
      res.json({ success: true, message: text });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ─── Vite / Static ──────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
