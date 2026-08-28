import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { NUDGE_MODEL, sanitizeNudge } from '@/lib/nudge';

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.includes('your_gemini_api_key')) {
      // Fallback response if GEMINI_API_KEY is not yet configured locally
      const fallbacks = [
        "Put your phones down together and share one highlight from your day.",
        "Take a 3-minute breath break while listening to ambient ocean waves.",
        "Draw a tiny doodle on a napkin and swap with each other.",
        "Ask each other: 'What made you smile unexpectedly this week?'",
        "Sit side-by-side in silence for 2 minutes while watching your fish swim."
      ];
      const randomFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      return NextResponse.json({ ritual: randomFallback, isFallback: true });
    }

    const body = await request.json();
    const { mood = 'Calm', loveLanguages = [] } = body;

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `The aquarium tank mood is currently set to "${mood}". The participants' love languages are ${
      loveLanguages.length > 0 ? loveLanguages.join(' and ') : 'words of affirmation and quality time'
    }. Write one warm, creative, low-effort shared ritual (1 sentence, under 18 words) for them to try right now while taking a phone-off break together. Do not use emoji, quotes, or greetings.`;

    const response = await ai.models.generateContent({
      model: NUDGE_MODEL,
      contents: prompt,
      config: {
        systemInstruction: 'You write one gentle, short, single-sentence ritual for a pair or group using a calm aquarium app called KIBO. Under 18 words. No greetings, no quotes, no emojis.',
        maxOutputTokens: 64,
        temperature: 0.9,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const sanitized = sanitizeNudge(response.text);
    const finalRitual = sanitized || "Put your phones face down and enjoy 5 quiet minutes together.";

    return NextResponse.json({ ritual: finalRitual, isFallback: false });
  } catch (error) {
    console.error('[kibo] AI ritual generation error:', error);
    return NextResponse.json({
      ritual: "Take a 5-minute phone-free pause together and watch the aquarium swim.",
      isFallback: true
    });
  }
}
