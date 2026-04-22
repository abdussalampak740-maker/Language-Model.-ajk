import { GoogleGenAI, Modality, ThinkingLevel } from "@google/genai";

// Lazy initialization function
let aiInstance: GoogleGenAI | null = null;
function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing. Please add it to your environment variables.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export interface VoiceResponse {
  text: string;
  audioBase64?: string;
  transcription?: string;
}

/**
 * Handles the speech-to-speech interaction using a two-phase approach
 * Optimized for speed using ThinkingLevel.LOW
 */
export async function processPahariSpeech(base64Audio: string, customRules: string = ""): Promise<VoiceResponse> {
  const ai = getAI();
  try {
    // Phase 1: Understanding & Inference (gemini-3-flash-preview with LOW thinking level for speed)
    const inferenceResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: base64Audio,
                mimeType: "audio/webm", 
              },
            },
            {
              text: "The user is talking in pure Azad Kashmiri Pahari. Respond with local idioms. " +
                    "IMPORTANT: Use commas for natural pauses. Reflect the fast, rhythmic highlands pace. " +
                    "Format: [Transcription: (user text)] [Response: (your text)]",
            },
          ],
        },
      ],
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction: "You are a native expert AI from the Azad Kashmir highlands (Poonch, Bagh, Muzaffarabad). " +
                           "Your goal is to provide authentic, fast, and rhythmic Pahari responses. " +
                           "Mandatory Dialect Rules: " +
                           "1. POSSESSIVE: Always use 'Na', 'Ne', 'Ni'. " +
                           "2. SELF: Use 'Maan' for 'I'. " +
                           "3. MOTION: Use 'Julna' for 'to go'. " +
                           "4. PROHIBITED: NEVER use the word 'Maara' as a filler. " +
                           customRules +
                           "\nSpeak with the authority of a village elder, but keep it fast for the interface.",
      },
    });

    const fullText = inferenceResponse.text || "";
    if (!fullText) {
       throw new Error("AI was unable to process your voice. Please try again.");
    }

    const transcription = fullText.match(/\[Transcription: (.*?)\]/)?.[1] || "";
    const aiResponseText = fullText.match(/\[Response: (.*?)\]/)?.[1] || fullText;

    // Phase 2: Professional TTS generation
    let audioBase64: string | undefined;
    try {
      const ttsResponse = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: aiResponseText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
             voiceConfig: { 
               prebuiltVoiceConfig: { voiceName: "Charon" } 
             }
          }
        },
      });
      
      const candidate = ttsResponse.candidates?.[0];
      if (candidate) {
        const audioPart = candidate.content?.parts?.find(p => p.inlineData);
        audioBase64 = audioPart?.inlineData?.data;
      }
    } catch (ttsErr: any) {
      console.warn("Speech Synthesis Phase Failed.", ttsErr);
    }

    return {
      text: aiResponseText,
      audioBase64,
      transcription
    };
  } catch (error) {
    console.error("Gemini Speech Processing Error:", error);
    throw error;
  }
}
