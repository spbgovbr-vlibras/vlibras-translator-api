import env from "../../config/environments/environment.js";
import sentimentPhraseBreaker from "./sentimentPhraseBreaker.js";

const emotionMapPT = {
  happy: "Feliz",
  sad: "Tristeza",
  anger: "Raiva",
  fear: "Medo",
  surprise: "Surpresa",
  neutral: "Neutro"
};

export default async function sentimentAnalyzer(fullText) {
  const API_KEY = env.DEEP_SEEK_API_KEY;
  if (!API_KEY) {
    throw new Error("ERRO_CONFIG: Chave da API DeepSeek não configurada.");
  }

  const API_URL = "https://api.deepseek.com/v1/chat/completions";
  const sentences = sentimentPhraseBreaker(fullText);

  const systemPrompt = `
# Persona and Objective
You are an advanced AI model trained as a Textual Emotion Analyst. Your task is to receive a text and return a JSON object containing the single, most dominant emotion detected.

## Valid Emotions
- happy: Joy, satisfaction, contentment, euphoria, relief, pride
- sad: Loss, sadness, disappointment, unhappiness, melancholy
- fear: Anxiety, apprehension, dread, worry, terror
- anger: Irritation, fury, frustration, indignation, annoyance
- surprise: Reaction to something unexpected (positive, negative, or neutral)
- neutral: Absence of clear emotion, purely informational text

## Rules
1. Identify **only the primary emotion** in the text.
2. Consider context, subtext, irony, sarcasm, and linguistic nuances.
3. Return strictly **a JSON object**, starting with { and ending with }.
4. Do not include text outside the JSON or comments.

## Examples

### happy
{"text": "I just got the news that I've been promoted! I can't stop smiling, what an amazing day!", "detected_emotions": ["happy"]}

### sad
{"text": "I just found out my childhood pet passed away. I can't stop crying.", "detected_emotions": ["sad"]}

### anger
{"text": "I can't believe he lied to me again! I'm boiling with anger and frustration.", "detected_emotions": ["anger"]}

### fear
{"text": "I have a big presentation tomorrow and I'm really nervous about speaking in front of everyone.", "detected_emotions": ["fear"]}

### surprise
{"text": "I had no idea you were all planning a party for me! I was completely shocked.", "detected_emotions": ["surprise"]}

### neutral
{"text": "The store is located at 123 Main Street.", "detected_emotions": ["neutral"]}
`;

  let sentimentoGeral = "Neutro";

  try {
    const safeFullText = fullText.normalize("NFC").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
    const payloadFull = {
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Identifique a emoção predominante neste texto completo: "${safeFullText}"` }
      ],
      temperature: 0
    };

    const responseFull = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
        "Accept": "application/json"
      },
      body: JSON.stringify(payloadFull)
    });

    if (!responseFull.ok) {
      let errorBody = await responseFull.text();
      try { errorBody = JSON.parse(errorBody); } catch { }
      throw new Error(`ERRO_API: HTTP ${responseFull.status}`);
    }

    const dataFull = await responseFull.json();
    const contentFull = dataFull?.choices?.[0]?.message?.content?.trim() || '{}';

    try {
      const parsedFull = JSON.parse(contentFull);
      if (parsedFull.detected_emotions && parsedFull.detected_emotions.length > 0) {
        const emotionENFull = parsedFull.detected_emotions[0].toLowerCase();
        sentimentoGeral = emotionMapPT[emotionENFull] || "Neutro";
      }
    } catch { }

  } catch { }

  const results = [];
  for (const sentence of sentences) {
    const safeSentence = sentence.normalize("NFC").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
    try {
      const payloadSent = {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Identifique a emoção predominante nesta frase: "${safeSentence}"` }
        ],
        temperature: 0
      };

      const responseSent = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`,
          "Accept": "application/json"
        },
        body: JSON.stringify(payloadSent)
      });

      if (!responseSent.ok) {
        results.push({ traducao: sentence, sentimento: "Neutro" });
        continue;
      }

      const dataSent = await responseSent.json();
      const contentSent = dataSent?.choices?.[0]?.message?.content?.trim() || '{}';
      let emotionPTSent = "Neutro";

      try {
        const parsedSent = JSON.parse(contentSent);
        if (parsedSent.detected_emotions && parsedSent.detected_emotions.length > 0) {
          const emotionENSent = parsedSent.detected_emotions[0].toLowerCase();
          emotionPTSent = emotionMapPT[emotionENSent] || "Neutro";
        }
      } catch { }

      results.push({ traducao: sentence, sentimento: emotionPTSent });

    } catch {
      results.push({ traducao: sentence, sentimento: "Neutro" });
    }
  }

  return {
    sentimentoGeral,
    sentimentoPorSentenca: results
  };
}
