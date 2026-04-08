import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../.env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../.env"),
];

for (const envPath of envPaths) {
  if (!config({ path: envPath }).error) break;
}

const API_KEY = process.env.GEMINI_API_KEY || "";
if (!API_KEY) {
  console.warn("[GeminiInit] ERROR: GEMINI_API_KEY is undefined");
}

const genAI = new GoogleGenerativeAI(API_KEY);

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class GeminiService {
  private cache = new Map<string, CacheEntry>();
  private requestQueue: number[] = [];
  private readonly MAX_REQUESTS_PER_MINUTE = 10;
  private readonly MODEL_NAME = "gemini-2.5-flash";

  private getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCache(key: string, data: any, ttl: number) {
    if (ttl <= 0) return;
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }

  private createKey(prefix: string, inputs: any): string {
    const str = JSON.stringify(inputs);
    const hash = crypto.createHash("sha256").update(str).digest("hex");
    return `${prefix}_${hash}`;
  }

  private async waitForRateLimit() {
    const now = Date.now();
    this.requestQueue = this.requestQueue.filter((t) => now - t < 60000);

    if (this.requestQueue.length >= this.MAX_REQUESTS_PER_MINUTE) {
      const oldest = this.requestQueue[0];
      const waitTime = Math.max(0, 60000 - (now - oldest));
      if (waitTime > 0) {
        console.log(`[GeminiService] Rate limit approached. Waiting ${waitTime}ms...`);
        await new Promise((r) => setTimeout(r, waitTime));
      }
      this.requestQueue.shift();
    }
    this.requestQueue.push(Date.now());
  }

  private async invokeWithRetry<T>(task: () => Promise<T>): Promise<T> {
    let delay = 2000;
    let lastError: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.waitForRateLimit();
        return await task();
      } catch (err: any) {
        console.error(`[GeminiService] Attempt ${attempt} failed:`, err.message);
        lastError = err;
        const is429 = err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("quota");
        if (is429 && attempt < 3) {
          console.log(`[GeminiService] Rate limited (429), retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
        } else if (attempt === 3) {
          break;
        } else {
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw new Error(`Gemini API unavailable: ${lastError?.message || "Unknown error"}`);
  }

  private getLangInstruction(language: string): string {
    const strictLang = language === "hi" ? "HINDI" : "ENGLISH";
    return `You are an assistant. Always respond strictly in ${strictLang} only. Do not switch languages under any circumstance.`;
  }

  // 1. Generate Advisory (6 hours TTL)
  public async generateAdvisory(params: any): Promise<string> {
    const { crop, acres, soil, district, state, temp, humidity, rainChance, date, question, language } = params;
    
    const key = this.createKey("advisory", params);
    const cached = this.getCache<string>(key);
    if (cached) return cached;

    const systemInstruction = this.getLangInstruction(language);
    const specificInstr = language === "hi" ? "Use Devanagari script entirely." : "Give practical, actionable advice.";

    const loc = district && state ? `${district}, ${state}, Eastern Uttar Pradesh, India` : district || state || "Eastern Uttar Pradesh, India";
    const prompt = `You are an expert agricultural advisor for farmers in Eastern Uttar Pradesh, India.
Farmer location: ${loc}.
Farmer's profile: Crop: ${crop}, Land: ${acres} acres, Soil: ${soil}.
Current weather: Temp ${temp}°C, Humidity ${humidity}%, Rain chance ${rainChance}%. Date: ${date}.
Question: ${question}.
${specificInstr} Keep response under 150 words. Format with bullet points. Start with a friendly greeting. Tailor advice to the farmer's state and district climate and practices where relevant.`;

    const model = genAI.getGenerativeModel({ 
      model: this.MODEL_NAME,
      systemInstruction
    });
    
    return this.invokeWithRetry(async () => {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      this.setCache(key, text, 6 * 60 * 60 * 1000); // 6 hours
      return text;
    });
  }

  // 2. Predict Price (1 hour TTL)
  public async predictPrice(params: any): Promise<any> {
    const { crop, currentPrice, month, language, state, district } = params;

    const key = this.createKey("price", params);
    const cached = this.getCache<any>(key);
    if (cached) return cached;

    const systemInstruction = this.getLangInstruction(language || "en");

    const loc =
      district && state
        ? `Farmer reference market area: ${district}, ${state}, Eastern Uttar Pradesh, India.`
        : state
          ? `Farmer reference region: ${state}, Eastern Uttar Pradesh, India.`
          : "Eastern Uttar Pradesh mandi/wholesale context.";
    const prompt = `You are an expert agricultural market analyst for Eastern Uttar Pradesh, India.
${loc}
Crop: ${crop}
Current price: ₹${currentPrice}/quintal
Current month: ${month}

Analyze the price trend for the next 30 days for mandis and wholesale markets relevant to Eastern Uttar Pradesh.
JSON format exactly like this:
{"predicted_price": 2150, "trend": "up", "trend_percent": 3.5, "confidence": "high", "best_time_to_sell": "...", "reasoning_hindi": "...", "reasoning_english": "...", "market_factors_hindi": ["..."], "market_factors_english": ["..."]}`;

    const model = genAI.getGenerativeModel({ 
      model: this.MODEL_NAME,
      systemInstruction,
      generationConfig: { responseMimeType: "application/json" }
    });

    return this.invokeWithRetry(async () => {
      const result = await model.generateContent(prompt);
      const data = JSON.parse(result.response.text());
      this.setCache(key, data, 1 * 60 * 60 * 1000); // 1 hour
      return data;
    });
  }

  // 3. Suggest Crop Plan (6 hours TTL)
  public async suggestCropPlan(params: any): Promise<any> {
    const { month, acres, waterSource, language, state, district } = params;
    
    const key = this.createKey("plan", params);
    const cached = this.getCache<any>(key);
    if (cached) return cached;

    const systemInstruction = this.getLangInstruction(language);
    const specificInstr = language === "hi" 
      ? "All reasoning fields must be in Hindi (Devanagari script)." 
      : "Reasoning should be in English.";

    const loc = district && state ? `Farmer location: ${district}, ${state}, Eastern Uttar Pradesh, India.` : state ? `Farmer state: ${state}, Eastern Uttar Pradesh, India.` : "Farmer location: Eastern Uttar Pradesh, India.";
    const prompt = `Suggest top 3 most profitable crops for a farmer in Eastern Uttar Pradesh, India. ${loc} Sow/Planting in ${month}, ${acres} acres, ${waterSource} irrigation. Provide a ranking suited to that region's agro-climatic zone where possible.
${specificInstr}
JSON array of 3 objects format exactly:
[{"crop_name":"...", "estimated_yield_per_acre":"...", "market_price_range":"...", "input_cost_estimate":"...", "profit_estimate":"...", "risk_level":"Low|Medium|High", "reasoning_hindi":"..."}]`;

    const model = genAI.getGenerativeModel({ 
      model: this.MODEL_NAME,
      systemInstruction,
      generationConfig: { responseMimeType: "application/json" }
    });

    return this.invokeWithRetry(async () => {
      const result = await model.generateContent(prompt);
      const data = JSON.parse(result.response.text());
      this.setCache(key, data, 6 * 60 * 60 * 1000); // 6 hours
      return data;
    });
  }

  // 4. Find Schemes (24 hours TTL)
  public async findSchemes(params: any): Promise<any> {
    const { profile, schemes, language } = params;

    const key = this.createKey("schemes", { profile, language });
    const cached = this.getCache<any>(key);
    if (cached) return cached;

    const systemInstruction = this.getLangInstruction(language);
    const specificInstr = language === "hi" 
      ? "All reasoning must be in Hindi (Devanagari script)." 
      : "Reasoning should be in English.";

    const loc =
      profile.district && profile.state
        ? `Farmer location: ${profile.district}, ${profile.state}, Eastern Uttar Pradesh, India.`
        : profile.state
          ? `Farmer state: ${profile.state}, Eastern Uttar Pradesh, India.`
          : "";
    const prompt = `Farmer in Eastern Uttar Pradesh, India. ${loc} ${profile.acres} acres, growing ${profile.crop}, ${profile.soil} soil.
Which of these schemes are they eligible for and most beneficial?
Schemes: ${JSON.stringify(schemes)}
Rank top 3 with reasoning. ${specificInstr}
JSON array format exactly:
[{"scheme_name":"exact name from list", "reasoning_hindi":"..."}]`;

    const model = genAI.getGenerativeModel({ 
      model: this.MODEL_NAME,
      systemInstruction,
      generationConfig: { responseMimeType: "application/json" }
    });

    return this.invokeWithRetry(async () => {
      const result = await model.generateContent(prompt);
      const data = JSON.parse(result.response.text());
      this.setCache(key, data, 24 * 60 * 60 * 1000); // 24 hours
      return data;
    });
  }

  // 5. Analyze Crop Image (No Cache)
  public async analyzeCropImage(params: { imageBase64: string, mimeType: string, cropType: string, language: string, state?: string, district?: string }): Promise<any> {
    const { imageBase64, mimeType, cropType, language, state, district } = params;

    const systemInstruction = this.getLangInstruction(language);
    const specificInstr = language === "hi" 
      ? "All text fields must be in Hindi (Devanagari script)." 
      : "Treatment and prevention steps should be in English.";

    const loc = district && state ? `Farmer location: ${district}, ${state}, Eastern Uttar Pradesh, India. Consider regional pests and weather patterns where relevant.` : "";
    const prompt = `You are an expert plant pathologist. Analyze this crop image. The crop is ${cropType}. ${loc} Identify any disease, pest infestation, nutrient deficiency, or confirm if the plant is healthy. ${specificInstr}
Output strictly as a single JSON object. Format exactly:
{"disease_name":"string", "confidence_percent": 90, "severity":"Low"|"Medium"|"High", "cause":"...", "treatment_steps":["step 1", "step 2"], "prevention_tips":["tip 1", "tip 2"], "is_healthy": false}`;

    const model = genAI.getGenerativeModel({ 
      model: this.MODEL_NAME,
      systemInstruction,
      generationConfig: { responseMimeType: "application/json" }
    });

    return this.invokeWithRetry(async () => {
      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType
        }
      };
      const result = await model.generateContent([prompt, imagePart]);
      return JSON.parse(result.response.text());
    });
  }
}

export const geminiService = new GeminiService();
