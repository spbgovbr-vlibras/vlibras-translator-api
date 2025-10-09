export async function testTranslationWithInference(text) {
  const lowerText = text.toLowerCase();
  let inferredSentimento = "neutro"; 

  if (lowerText.includes("feliz") || lowerText.includes("alegre") || lowerText.includes("ótimo")) {
    inferredSentimento = "feliz";
  } else if (lowerText.includes("medo") || lowerText.includes("assustado")) {
    inferredSentimento = "medo";
  } else if (lowerText.includes("raiva") || lowerText.includes("irritado")) {
    inferredSentimento = "raiva";
  } else if (lowerText.includes("surpresa") || lowerText.includes("incrível")) {
    inferredSentimento = "surpresa";
  } else if (lowerText.includes("triste") || lowerText.includes("deprimido")) {
    inferredSentimento = "triste";
  }

  // ----- Chamada real ao DeepSeek (comentada) -----
  /*
  try {
    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
    const apiUrl = "https://api.deepseek.com/v1/infer";

    const prompt = {
      input: text,
      instructions: "Identifique o sentimento do texto. Retorne como uma das chaves: feliz, medo, neutro, raiva, surpresa, triste."
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({ prompt })
    });

    const data = await response.json();
    inferredSentimento = data.sentimento || "neutro";
  } catch (err) {
    console.error("Erro ao chamar DeepSeek:", err);
  }
  */

  return {
    glosa: `${text} (tradução simulada)`,
    sentimento: inferredSentimento,
    version: "x.p.t.o"
  };
}