import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

// Extended diagnosis types for industry-level crop analysis
export interface CropHealthScore {
  overall: number;
  breakdown: {
    disease: number;
    pest: number;
    nutrient: number;
    water: number;
  };
  factors: string[];
}

export interface GrowthStage {
  current: 'seedling' | 'vegetative' | 'flowering' | 'fruiting' | 'harvest';
  health: 'excellent' | 'good' | 'fair' | 'poor';
  daysToNextStage?: number;
}

export interface PestDetection {
  name: string;
  severity: 'Low' | 'Medium' | 'High';
  treatment: string[];
}

export interface NutrientDeficiency {
  element: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
  symptoms: string[];
}

export interface TreatmentOption {
  steps: string[];
  costEstimate: string;
  costRange?: { min: number; max: number };
  products: { name: string; quantity: string; approxCost: string }[];
}

export interface TreatmentSchedule {
  day1: string[];
  day7: string[];
  day14: string[];
}

export interface CropDiagnosis {
  disease_name: string;
  confidence_percent: number;
  severity: 'Low' | 'Medium' | 'High';
  cause: string;
  treatment_steps: string[];
  prevention_tips: string[];
  is_healthy: boolean;
  healthScore: CropHealthScore;
  growthStage: GrowthStage;
  pestDetection?: PestDetection[];
  nutrientDeficiency?: NutrientDeficiency[];
  waterStress?: 'over' | 'under' | 'none';
  treatmentOptions?: {
    organic: TreatmentOption;
    chemical: TreatmentOption;
  };
  treatmentSchedule?: TreatmentSchedule;
  suggested_inventory_tags?: string[];
}

class GeminiClientService {
  private cache = new Map<string, CacheEntry>();
  private requestQueue: number[] = [];
  private readonly MAX_REQUESTS_PER_MINUTE = 15;
  // Standard model name without "models/" prefix
  private readonly MODEL_NAME = "gemini-3.1-flash-lite";

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
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        await this.waitForRateLimit();
        return await task();
      } catch (err: any) {
        console.error(`Attempt ${attempt} failed:`, err.message);
        lastError = err;
        const is429 = err?.status === 429 || err?.message?.toLowerCase().includes("quota") || err?.message?.toLowerCase().includes("429");
        if (is429 && attempt < 4) {
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
        } else if (attempt === 4) {
          break;
        } else {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }
    throw new Error(lastError?.message || "AI unavailable");
  }

  private getLangInstruction(language: string): string {
    const strictLang = language === "hi" ? "HINDI" : "ENGLISH";
    return `You are an expert agricultural advisor for farmers in Eastern Uttar Pradesh, India. Always respond strictly in ${strictLang} only. Use Devanagari script for Hindi responses.`;
  }

  public async generateAdvisory(params: any): Promise<string> {
    const key = this.createKey("advisory", params);
    const cached = this.getCache<string>(key);
    if (cached) return cached;

    const { crop, acres, soil, district, state, temp, humidity, rainChance, date, question, language } = params;
    const systemInstruction = this.getLangInstruction(language);
    const loc = district && state ? `${district}, ${state}, Eastern Uttar Pradesh` : "Eastern Uttar Pradesh";

    const prompt = `You are an expert agricultural advisor for farmers in Eastern Uttar Pradesh.
Location: ${loc}. Crop: ${crop}, Land: ${acres} acres, Soil: ${soil}.
Weather: Temp ${temp}°C, Humidity ${humidity}%, Rain: ${rainChance}%. Date: ${date}.
Question: ${question}
Give practical, actionable advice. Format response clearly with bullet points. Max 150 words.`;

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
${JSON.stringify(schemes.slice(0, 10).map((s: any) => ({ n: s.name, d: s.description })))}
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

  public async analyzeCropImage(params: {
    images: string | string[];
    cropType: string;
    language: string;
    state: string;
    district: string;
  }): Promise<CropDiagnosis> {
    const { images, cropType, language, state, district } = params;

    // Normalize to array
    const imageArray = Array.isArray(images) ? images : [images];
    const numImages = imageArray.length;
    const systemInstruction = this.getLangInstruction(language);
    const loc = district && state ? `${district}, ${state}` : "Eastern Uttar Pradesh";

    // Build image parts
    const imageParts = imageArray.map((img) => {
      const matches = img.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches) throw new Error("Invalid image data");
      return {
        inlineData: {
          data: matches[2],
          mimeType: matches[1]
        }
      };
    });

    const cropContext = numImages > 1
      ? `Analyze ${numImages} crop photos for comprehensive health assessment.`
      : "Analyze this crop photo.";

    const prompt = `${cropContext} Crop: ${cropType}. Location: ${loc}, Eastern Uttar Pradesh, India.
Identify diseases, pests, nutrient deficiencies, and growth stage common in this climate zone.

Return STRICTLY valid JSON object (no markdown, no extra text):
{
  "disease_name": "Healthy | Early Blight | Late Blight | Powdery Mildew | Leaf Spot | Rust | Other",
  "confidence_percent": 85,
  "severity": "Low | Medium | High",
  "cause": "Brief explanation of the cause",
  "treatment_steps": ["Step 1", "Step 2", "Step 3"],
  "prevention_tips": ["Tip 1", "Tip 2", "Tip 3"],
  "is_healthy": false,
  "healthScore": {
    "overall": 65,
    "breakdown": {"disease": 20, "pest": 10, "nutrient": 5, "water": 0},
    "factors": ["Factor 1", "Factor 2"]
  },
  "growthStage": {
    "current": "seedling | vegetative | flowering | fruiting | harvest",
    "health": "excellent | good | fair | poor",
    "daysToNextStage": 21
  },
  "pestDetection": [{"name": "Aphids", "severity": "Low | Medium | High", "treatment": ["Step 1", "Step 2"]}],
  "nutrientDeficiency": [{"element": "Nitrogen | Phosphorus | Potassium | Iron | Zinc", "severity": "Mild | Moderate | Severe", "symptoms": ["Symptom 1", "Symptom 2"]}],
  "waterStress": "over | under | none",
  "treatmentOptions": {
    "organic": {
      "steps": ["Use neem oil spray", "Apply compost tea", "Remove affected leaves"],
      "costEstimate": "₹200-500",
      "costRange": {"min": 200, "max": 500},
      "products": [{"name": "Neem Oil", "quantity": "50ml", "approxCost": "₹80"}, {"name": "Compost", "quantity": "2kg", "approxCost": "₹100"}]
    },
    "chemical": {
      "steps": ["Apply fungicide", "Use balanced NPK", "Drain excess water"],
      "costEstimate": "₹150-300",
      "costRange": {"min": 150, "max": 300},
      "products": [{"name": "Ridomil Gold", "quantity": "100g", "approxCost": "₹150"}, {"name": "NPK 10-10-10", "quantity": "500g", "approxCost": "₹120"}]
    }
  },
  "treatmentSchedule": {
    "day1": ["Action 1", "Action 2"],
    "day7": ["Action 1", "Action 2"],
    "day14": ["Action 1", "Action 2"]
  },
  "suggested_inventory_tags": ["tag1", "tag2", "tag3"]
}

The "suggested_inventory_tags" field MUST be a JSON array of 2-5 lowercase tags that match our product inventory. Use disease name keywords, pest names, nutrient names, and treatment type keywords. Examples:
- For fungal disease: ["fungicide", "blight", "chemical"]
- For pest attack: ["insecticide", "aphids", "imidacloprid", "chemical"]
- For nitrogen deficiency: ["nitrogen", "urea", "fertilizer"]
- For healthy plant: ["fertilizer", "growth", "npk"]
- For organic treatment: ["neem", "organic", "pest-control"]
`;

    const model = genAI!.getGenerativeModel({
      model: this.MODEL_NAME,
      systemInstruction,
      generationConfig: { responseMimeType: "application/json" }
    });

    return this.invokeWithRetry(async () => {
      const contentParts = [prompt, ...imageParts];
      const result = await model.generateContent(contentParts);
      const raw = JSON.parse(result.response.text());

      // Normalize and validate
      const treatment = Array.isArray(raw.treatment_steps) ? raw.treatment_steps.map(String) : [];
      const prevention = Array.isArray(raw.prevention_tips) ? raw.prevention_tips.map(String) : [];

      // Ensure healthScore exists
      const healthScore = raw.healthScore || {
        overall: raw.is_healthy ? 95 : 50,
        breakdown: { disease: 0, pest: 0, nutrient: 0, water: 0 },
        factors: []
      };

      // Ensure growthStage exists
      const growthStage = raw.growthStage || {
        current: "vegetative",
        health: raw.is_healthy ? "good" : "fair"
      };

      return {
        disease_name: String(raw.disease_name ?? "Unknown"),
        confidence_percent: Number(raw.confidence_percent ?? 0),
        severity: ["Low", "Medium", "High"].includes(String(raw.severity)) ? raw.severity : "Medium",
        cause: String(raw.cause ?? ""),
        treatment_steps: treatment.length ? treatment : ["—"],
        prevention_tips: prevention.length ? prevention : ["—"],
        is_healthy: Boolean(raw.is_healthy ?? false),
        healthScore,
        growthStage,
        pestDetection: raw.pestDetection || undefined,
        nutrientDeficiency: raw.nutrientDeficiency || undefined,
        waterStress: raw.waterStress || undefined,
        treatmentOptions: raw.treatmentOptions || undefined,
        treatmentSchedule: raw.treatmentSchedule || undefined,
        suggested_inventory_tags: Array.isArray(raw.suggested_inventory_tags) ? raw.suggested_inventory_tags : [],
      };
    });
  }
}

export const geminiClient = new GeminiClientService();