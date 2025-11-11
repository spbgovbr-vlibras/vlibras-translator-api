import env from "../../config/environments/environment.js";
import sentimentPhraseBreaker from "./sentimentPhraseBreaker.js";

function safeParseJSON(text) {
  if (!text || typeof text !== "string") return {};
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]);
  } catch {
    return {};
  }
}

const emotionMapPT = {
  happy: "Feliz",
  sad: "Tristeza",
  anger: "Raiva",
  fear: "Medo",
  surprise: "Surpresa",
  neutral: "Neutro"
};

export default async function sentimentAnalyzer(originalText, translatedText = "") {
  const API_KEY = env.DEEP_SEEK_API_KEY;
  if (!API_KEY) {
    throw new Error("ERRO_CONFIG: Chave da API DeepSeek não configurada.");
  }

  let fetchFn = global.fetch;
  if (!fetchFn) {
    try {
      const mod = await import("node-fetch");
      fetchFn = mod.default;
    } catch (err) {
      throw new Error("Fetch não disponível e 'node-fetch' não pôde ser carregado.");
    }
  }

  const API_URL = "https://api.deepseek.com/v1/chat/completions";

  const sentencesOriginal = Array.isArray(sentimentPhraseBreaker(originalText))
    ? sentimentPhraseBreaker(originalText)
    : (originalText ? [originalText] : []);
  const sentencesTranslated = translatedText
    ? (Array.isArray(sentimentPhraseBreaker(translatedText)) ? sentimentPhraseBreaker(translatedText) : [translatedText])
    : sentencesOriginal.slice();

  const systemPrompt = `
      You are an advanced Textual Emotion Analyst. Return strictly a JSON object with a single key "detected_emotions"
      whose value is an array with the single primary emotion as one of: happy, sad, anger, fear, surprise, neutral.
      Do NOT add any extra text.
  `;

  async function analyzeWithDeepSeek(textToAnalyze) {
    try {
      const safeText = JSON.stringify(String(textToAnalyze || "").normalize("NFC"));

      const payload = {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Identifique a emoção predominante neste texto: ${safeText}` }
        ],
        temperature: 0
      };

      const resp = await fetchFn(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`,
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const respText = await resp.text();
      console.log("UUUU", respText);

      if (!resp.ok) {
        return "neutral";
      }

      let emotionEN = "neutral";

      try {
        const parsedOuter = JSON.parse(respText);

        const contentStr = parsedOuter?.choices?.[0]?.message?.content?.trim() || "{}";

        const parsedInner = safeParseJSON(contentStr);

        emotionEN = (parsedInner?.detected_emotions?.[0] || "neutral").toLowerCase();
      } catch {
        emotionEN = "neutral";
      }

      return emotionEN;

    } catch {
      return "neutral";
    }
  }

  let sentimentoGeral = "Neutro";
  try {
    const emotionENFull = await analyzeWithDeepSeek(originalText);
    sentimentoGeral = emotionMapPT[emotionENFull] || "Neutro";
  } catch {
    sentimentoGeral = "Neutro";
  }

  const results = [];
  const maxLen = Math.max(sentencesOriginal.length, sentencesTranslated.length);

  for (let i = 0; i < maxLen; i++) {
    const sentenceOrig = sentencesOriginal[i] ?? "";
    const sentenceTrans = sentencesTranslated[i] ?? sentenceOrig;

    let emotionPTSent = "Neutro";
    try {
      const emotionENSent = await analyzeWithDeepSeek(sentenceOrig || sentenceTrans);
      emotionPTSent = emotionMapPT[emotionENSent] || "Neutro";
    } catch {
      emotionPTSent = "Neutro";
    }

    results.push({
      traducao: sentenceTrans,
      sentimento: emotionPTSent
    });
  }

  return {
    sentimentoGeral,
    sentimentoPorSentenca: results
  };
}
