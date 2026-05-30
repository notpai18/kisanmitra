import { geminiService } from "../server/services/GeminiService.js";

async function test() {
  console.log("Testing Gemini API...");
  try {
    const text = await geminiService.generateAdvisory({
      crop: "wheat",
      acres: 1,
      soil: "loamy",
      district: "Varanasi",
      state: "Uttar Pradesh",
      temp: 25,
      humidity: 40,
      rainChance: 0,
      date: new Date().toISOString(),
      question: "Test connection reply with exact the word: success.",
      language: "en"
    });
    console.log("Response:", text);
    if (text.toLowerCase().includes("success")) {
      console.log("TEST SUCCESSFUL");
    } else {
      console.log("TEST FAILED: Unexpected response content");
    }
  } catch (error) {
    console.error("TEST FAILED with error:", error);
  }
}

test();
