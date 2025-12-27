import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult } from '../types';

export const analyzeFiles = async (filenames: string[], apiKey: string): Promise<AIAnalysisResult[]> => {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  // Initialize Gemini Client with provided API key
  const ai = new GoogleGenAI({ apiKey });
  if (filenames.length === 0) return [];

  // Batching logic could be added here for very large folders, 
  // but for simplicity we'll send up to 500 at a time or just one batch for the demo.
  // We will truncate strictly to avoid token limits if necessary.
  const safeFilenames = filenames.slice(0, 500); 

  const prompt = `
    You are an intelligent file organization assistant. 
    Analyze the following list of filenames.
    For each file, suggest a semantic category (e.g., 'Financial', 'Personal', 'Work', 'Images', 'Installers', 'Code', 'Books').
    Create a 'suggestedPath' which is a folder structure based on the category (e.g., 'Documents/Financial').
    
    CRITICAL SECURITY RULE:
    If a filename suggests it contains SENSITIVE PERSONAL INFORMATION (e.g., 'passport', 'id_card', 'tax_return', 'medical_report', 'recovery_phrase', 'password'),
    you MUST mark 'isSensitive' as true and set the 'suggestedPath' to start with 'Secret/'.
    
    Generate meaningful tags based on the filename keywords.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
        ${prompt}
        
        List of filenames:
        ${JSON.stringify(safeFilenames)}
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              originalName: { type: Type.STRING },
              suggestedCategory: { type: Type.STRING },
              suggestedPath: { type: Type.STRING },
              isSensitive: { type: Type.BOOLEAN },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              reasoning: { type: Type.STRING },
            },
            required: ["originalName", "suggestedCategory", "suggestedPath", "isSensitive", "tags"],
          },
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as AIAnalysisResult[];
    }
    return [];
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return [];
  }
};