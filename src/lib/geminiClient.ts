import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class GeminiClientService {
  private cache = new Map<string, CacheEntry>();
  private requestQueue: number[] = [];
  private readonly MAX_REQUESTS_PER_MINUTE = 10;
  private readonly MODEL_NAME = "gemini-2.5-flash"; // Use the latest available stable model

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
    return `${prefix}_${JSON.stringify(inputs)}`;
  }

  private async waitForRateLimit() {
    const now = Date.now();
    this.requestQueue = this.requestQueue.filter((t) => now - t < 60000);

    if (this.requestQueue.length >= this.MAX_REQUESTS_PER_MINUTE) {
      const oldest = this.requestQueue[0];
      const waitTime = Math.max(0, 60000 - (now - oldest));
      if (waitTime > 0) {
        await new Promise((r) => setTimeout(r, waitTime));
      }
      this.requestQueue.shift();
    }
    this.requestQueue.push(Date.now());
  }

  private async invokeWithRetry<T>(task: () => Promise<T>): Promise<T> {
    if (!genAI) {
      throw new Error("Gemini API Key is missing from environment variables.");
    }
    let delay = 2000;
    let lastError: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.waitForRateLimit();
        return await task();
      } catch (err: any) {
        console.error(`Attempt ${attempt} failed:`, err.message);
        lastError = err;
        const is429 = err?.status === 429 || err?.message?.toLowerCase().includes("quota") || err?.message?.toLowerCase().includes("429");
        if (is429 && attempt < 3) {
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
        } else if (attempt === 3) {
          break;
        } else {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
    throw new Error(lastError?.message || "AI unavailable");
  }

  private getLangInstruction(language: string): string {
    const strictLang = language === "hi" ? "HINDI" : "ENGLISH";
    return `You are an assistant. Always respond strictly in ${strictLang} only. Do not switch languages under any circumstance.`;
  }

  public async generateAdvisory(params: any): Promise<string> {
    const key = this.createKey("advisory", params);
    const cached = this.getCache<string>(key);
    if (cached) return cached;

    const { crop, acres, soil, district, state, temp, humidity, rainChance, date, question, language } = params;
    const systemInstruction = this.getLangInstruction(language);
    const specificInstr = language === "hi" ? "Use Devanagari script entirely." : "Give practical, actionable advice.";
    const loc = district && state ? `${district}, ${state}, Eastern Uttar Pradesh` : "Eastern Uttar Pradesh";
    
    const prompt = `You are an expert agricultural advisor for farmers in Eastern Uttar Pradesh.
Location: ${loc}. Crop: ${crop}, Land: ${acres} acres, Soil: ${soil}.
Weather: Temp ${temp}°C, Humidity ${humidity}%, Rain: ${rainChance}%. Date: ${date}.
Question: ${question}.
${specificInstr} Format response clearly with bullet points. Max 150 words.`;

    const model = genAI!.getGenerativeModel({ model: this.MODEL_NAME, systemInstruction });
    
    return this.invokeWithRetry(async () => {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      this.setCache(key, text, 60 * 60 * 1000);
      return text;
    });
  }

  public async predictPrice(params: any): Promise<any> {
    const key = this.createKey("price", params);
    const cached = this.getCache<any>(key);
    if (cached) return cached;

    const { crop, currentPrice, month, language, state, district } = params;
    const systemInstruction = this.getLangInstruction(language || "en");
    const loc = district ? `${district}, ${state || ''}` : "Eastern Uttar Pradesh";
    
    const prompt = `Expert analysis for market area: ${loc}.
Crop: ${crop}. Current: ₹${currentPrice}/quintal. Month: ${month}.
Predict price trend next 30 days in that specific region.
Return strictly valid JSON:
{"predicted_price": 2200, "trend": "up", "trend_percent": 4, "confidence": "high", "best_time_to_sell": "Next 2 weeks", "reasoning_hindi": "Hindi Text", "reasoning_english": "Eng Text", "market_factors_hindi": ["Fact 1"], "market_factors_english": ["Fact 1"]}`;

    const model = genAI!.getGenerativeModel({ 
      model: this.MODEL_NAME, 
      systemInstruction, 
      generationConfig: { responseMimeType: "application/json" }
    });

    return this.invokeWithRetry(async () => {
      const result = await model.generateContent(prompt);
      const data = JSON.parse(result.response.text());
      this.setCache(key, data, 30 * 60 * 1000);
      return data;
    });
  }

  public async suggestCropPlan(params: any): Promise<any> {
    const key = this.createKey("plan", params);
    const cached = this.getCache<any>(key);
    if (cached) return cached;

    const { month, acres, waterSource, language, state, district } = params;
    const systemInstruction = this.getLangInstruction(language);
    const loc = district && state ? `${district}, ${state}` : "Eastern Uttar Pradesh";

    const prompt = `Top 3 most profitable crops for Eastern Uttar Pradesh region. Location: ${loc}. Sowing in ${month}, ${acres} acres, ${waterSource} source.
Return STRICTLY JSON array:
[{"crop_name":"...", "estimated_yield_per_acre":"...", "market_price_range":"...", "input_cost_estimate":"...", "profit_estimate":"...", "risk_level":"Low|Medium|High", "reasoning_hindi":"Hindi/English text fitting the language instruction."}]`;

    const model = genAI!.getGenerativeModel({ 
      model: this.MODEL_NAME, 
      systemInstruction, 
      generationConfig: { responseMimeType: "application/json" } 
    });

    return this.invokeWithRetry(async () => {
      const result = await model.generateContent(prompt);
      const data = JSON.parse(result.response.text());
      this.setCache(key, data, 60 * 60 * 1000);
      return data;
    });
  }

  public async findSchemes(params: any): Promise<any> {
    const { profile, schemes, language } = params;
    const key = this.createKey("schemes", { p: profile.acres, c: profile.crop, l: language });
    const cached = this.getCache<any>(key);
    if (cached) return cached;

    const systemInstruction = this.getLangInstruction(language);
    const prompt = `Profile: ${profile.acres} acres, growing ${profile.crop}, location ${profile.district || ''}.
Match the most beneficial 3 government schemes from this static list:
${JSON.stringify(schemes.slice(0, 10).map((s: any) => ({n: s.name, d: s.description})))}
Return STRICTLY JSON array:
[{"scheme_name":"Exact name from list", "reasoning_hindi":"Reasoning in appropriate requested language"}]`;

    const model = genAI!.getGenerativeModel({ 
      model: this.MODEL_NAME, 
      systemInstruction, 
      generationConfig: { responseMimeType: "application/json" } 
    });

    return this.invokeWithRetry(async () => {
      const result = await model.generateContent(prompt);
      const data = JSON.parse(result.response.text());
      this.setCache(key, data, 2 * 60 * 60 * 1000);
      return data;
    });
  }

  public async analyzeCropImage(params: { image: string, cropType: string, language: string, state: string, district: string }): Promise<any> {
    const { image, cropType, language, state, district } = params;
    const systemInstruction = this.getLangInstruction(language);

    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches) throw new Error("Invalid image data");
    const mimeType = matches[1];
    const base64Data = matches[2];

    const prompt = `Analyze this crop photo. Crop: ${cropType}. Location: ${district}, ${state}. Identify any specific diseases common in this climate or verify if healthy.
Return strictly JSON object:
{"disease_name":"String", "confidence_percent": 90, "severity":"Low"|"Medium"|"High", "cause":"String", "treatment_steps":["step"], "prevention_tips":["tip"], "is_healthy": false}`;

    const model = genAI!.getGenerativeModel({ 
      model: this.MODEL_NAME, 
      systemInstruction, 
      generationConfig: { responseMimeType: "application/json" } 
    });

    return this.invokeWithRetry(async () => {
      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      };
      const result = await model.generateContent([prompt, imagePart]);
      const raw = JSON.parse(result.response.text());
      
      // Apply transformation/mapping from server.ts exactly
      const treatment = Array.isArray(raw.treatment_steps) ? raw.treatment_steps.map(String) : [];
      const prevention = Array.isArray(raw.prevention_tips) ? raw.prevention_tips.map(String) : [];
      
      return {
        disease_name: String(raw.disease_name ?? "Unknown"),
        confidence_percent: Number(raw.confidence_percent ?? 0),
        severity: ["Low", "Medium", "High"].includes(String(raw.severity)) ? raw.severity : "Medium",
        cause: String(raw.cause ?? ""),
        treatment_steps: treatment.length ? treatment : ["—"],
        prevention_tips: prevention.length ? prevention : ["—"],
        is_healthy: Boolean(raw.is_healthy),
      };
    });
  }
}

export const geminiClient = new GeminiClientService();
