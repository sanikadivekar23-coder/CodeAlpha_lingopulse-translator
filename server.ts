import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Initialize Gemini API Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for body parsing
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Translation route powered by Gemini
  app.post("/api/translate", async (req, res): Promise<any> => {
    try {
      const { text, sourceLang, targetLang, tone = "balanced" } = req.body;

      if (!text || text.trim() === "") {
        return res.status(400).json({ error: "Please enter text to translate" });
      }

      if (!targetLang) {
        return res.status(400).json({ error: "Please select a target language" });
      }

      // We ask the model to perform translation, detect languages, suggest alternative outputs,
      // and provide grammatical breakdown in one single request
      const prompt = `Translate the following text.
Text to translate: "${text}"
Desired Target Language: "${targetLang}"
Source Language Specified: "${sourceLang || 'auto-detect'}"
Requested Tone/Style: "${tone}"

Provide the translation, the detected source language (especially if the source language was requested as auto-detect), BCP-47 / IETF code for the language, beautiful alternative variations of the translation with their typical styles/nuance, a guide on how to pronounce the translated text phonetically/romanized, and a dictionary/grammatical breakdown of key words or expressions for language learning.`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          translatedText: {
            type: Type.STRING,
            description: "The translated text matching the requested style/tone."
          },
          detectedLanguageCode: {
            type: Type.STRING,
            description: "The BCP-47 language tag of the detected source language (e.g., 'en', 'es', 'hi', 'fr')."
          },
          detectedLanguageName: {
            type: Type.STRING,
            description: "The English name of the detected source language (e.g., 'English', 'Spanish', 'Hindi', 'French')."
          },
          alternatives: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING, description: "Alternative translation option." },
                description: { type: Type.STRING, description: "Context in which this alternative is best suited (e.g. 'Formal business context', 'Casual street slang', 'Literary/poetic style')." }
              }
            },
            description: "2-3 alternative phrasing options for translating this phrase."
          },
          breakdown: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                originalWord: { type: Type.STRING, description: "Key word or phrase from the original text." },
                translatedWord: { type: Type.STRING, description: "Direct equivalent in target language." },
                meaning: { type: Type.STRING, description: "Brief meaning, grammatical role (e.g. verb, noun, formal suffix) and nuance." },
                pronunciation: { type: Type.STRING, description: "Phonetic guide, Romanization (Pinyin, Romaji, etc.) or spelling helper." }
              }
            },
            description: "Detailed term-by-term vocabulary breakdown of important elements to help learners."
          },
          pronunciationGuide: {
            type: Type.STRING,
            description: "Phonetic pronunciation guide or Romanization for the total translated sentence."
          }
        },
        required: [
          "translatedText",
          "detectedLanguageCode",
          "detectedLanguageName",
          "alternatives",
          "breakdown",
          "pronunciationGuide"
        ]
      };

      const systemInstruction = `You are a world-class translation program and linguistic assistant.
You translate text accurately, naturally, and contextfully based on the source and target languages.
You must carefully preserve the source text's intensity, emotion, and intent, but adapt its expression to the requested tone (e.g. formal, casual, slang, literal, idiomatic).
Always return a structured JSON response matching the requested schema definition.
Do not wrap your output in markdown formatting outside the JSON, just output the raw JSON directly.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.3,
        }
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("Empty response received from the translation service.");
      }

      const info = JSON.parse(resultText.trim());
      res.json(info);

    } catch (error: any) {
      console.error("Translation server error:", error);
      res.status(500).json({
        error: "Translation failed. Please ensure the service is online and try again.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Vite integration
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

  // PORT is 3000 as per runtime directives
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting on http://0.0.0.0:${PORT}`);
  });
}

startServer();
