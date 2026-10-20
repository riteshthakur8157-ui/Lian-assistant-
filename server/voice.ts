import { ai } from "./gemini.js";
import { WebSocket } from "ws";

export const VoiceService = {
  // Generate spoken audio using gemini-3.8-flash-lite-tts with graceful client fallback
  synthesizeSpeech: async (
    text: string,
    voiceName: string = "Aoede"
  ): Promise<{ audioBase64?: string; useClientTts?: boolean; error?: string }> => {
    try {
      // Clean markdown symbols or asterisks from spoken text for natural diction
      const cleanSpokenText = text
        .replace(/[*_#`[\]()]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!cleanSpokenText) return { useClientTts: true };

      // Limit to first 120 words for low-latency fast response audio
      const truncated = cleanSpokenText.split(" ").slice(0, 120).join(" ");

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash-lite-tts",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: truncated,
                speechMetadata: {
                  style: "Loving, warm, natural female conversational companion",
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName || "Aoede" },
            },
          },
        },
      });

      const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return { audioBase64, useClientTts: !audioBase64 };
    } catch (err: any) {
      const isQuota = err?.message?.includes("429") || err?.message?.includes("RESOURCE_EXHAUSTED");
      if (isQuota) {
        console.log("Gemini TTS daily quota reached, seamlessly falling back to browser voice engine.");
      } else {
        console.warn("TTS notice (using browser voice):", err?.message);
      }
      return { useClientTts: true, error: err?.message };
    }
  },

  // Bridge client WebSocket to Gemini Live API
  setupLiveSession: async (clientWs: WebSocket, config: { voice?: string; language?: string } = {}) => {
    try {
      const session = await (ai as any).live.connect({
        model: "gemini-2.0-flash-exp",
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voice || "Aoede" } },
          },
          systemInstruction: "You are Lina, a warm, caring, loving AI voice companion. You speak naturally in Hinglish, Hindi, and English. Keep replies concise and conversational.",
        },
        callbacks: {
          onmessage: (message: any) => {
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "audio", audio }));
            }
            if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "interrupted" }));
            }
          },
          onerror: (err: any) => {
            console.error("Live API error:", err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "error", message: err.message }));
            }
          },
          onclose: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "status", status: "closed" }));
            }
          }
        },
      });

      clientWs.on("message", (data: any) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.audio) {
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
            });
          }
        } catch (e) {
          console.error("Error processing client live audio chunk:", e);
        }
      });

      clientWs.on("close", () => {
        try {
          session.close();
        } catch {}
      });

      clientWs.send(JSON.stringify({ type: "ready", model: "gemini-2.0-flash-exp" }));
    } catch (err: any) {
      console.warn("Live API connection unavailable, fallback enabled:", err.message);
      clientWs.send(JSON.stringify({ type: "fallback_ready", reason: err.message }));
    }
  }
};
