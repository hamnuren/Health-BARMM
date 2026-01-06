import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// Instantiate right before use to ensure updated API key as per guidelines
export const searchLocation = async (query: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      lat: { type: Type.NUMBER, description: 'Latitude coordinate' },
      lng: { type: Type.NUMBER, description: 'Longitude coordinate' },
      name: { type: Type.STRING, description: 'Matched location name' },
      isMindanao: { type: Type.BOOLEAN, description: 'Whether the location is in Mindanao' }
    },
    required: ["lat", "lng", "name", "isMindanao"]
  };

  const prompt = `
    The user is looking for a location in the Philippines, specifically Mindanao/BARMM. 
    Query: "${query}"
    Provide the most likely Latitude and Longitude for this place.
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });
    // Use .text property directly
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Search Error:", error);
    return null;
  }
};

export const analyzeRegionalData = async (points: any[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';

  const summary = points.reduce((acc: any, p: any) => {
    const prov = p.data?.Province || 'Unknown';
    acc[prov] = (acc[prov] || 0) + 1;
    return acc;
  }, {});

  const prompt = `
    Act as a senior regional planner for the Bangsamoro Autonomous Region in Muslim Mindanao (BARMM).
    Analyze this dataset: Total Facilities: ${points.length}. Distribution: ${JSON.stringify(summary)}.
    Provide a concise strategic assessment (max 100 words) regarding infrastructure distribution.
    No bullets, single cohesive paragraph.
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
    });
    // Use .text property directly
    return response.text || "AI insights temporarily unavailable.";
  } catch (error) {
    return "AI insights temporarily unavailable.";
  }
};