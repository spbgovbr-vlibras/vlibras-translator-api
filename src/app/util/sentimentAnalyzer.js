import env from "../../config/environments/environment.js";

export default async function sentimentAnalyzer(fullText) {

  const prompt = `Analise o texto a seguir, que está em formato de glossário LIBRAS.
1. Identifique as sentenças ou cláusulas conceituais dentro do texto.
2. Para CADA sentença/cláusula identificada, determine seu sentimento (feliz, medo, raiva, surpresa, tristeza ou neutro).
3. Determine o sentimento GERAL predominante do texto completo.
4. Retorne SOMENTE UM JSON VÁLIDO no seguinte formato, sem nenhum texto antes ou depois:
{
  "sentimentoGeral": "<sentimento_geral_predominante>",
  "sentimentoPorSentenca": [
    { "traducao": "<texto_da_primeira_sentenca_ou_clausula>", "sentimento": "<sentimento_da_primeira>" },
    { "traducao": "<texto_da_segunda_sentenca_ou_clausula>", "sentimento": "<sentimento_da_segunda>" },
    ...
  ]
}

Texto a ser analisado: "${fullText}"`;

  const API_KEY = env.API_KEY;

  if (!API_KEY) {
    console.error("ERRO: A variável de ambiente API_KEY não está definida.");
    throw new Error("ERRO_CONFIG: Chave da API Gemini não configurada.");
  }

 const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${API_KEY}`;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          "response_mime_type": "application/json",
        }
      }),
    });

    if (!response.ok) {
        let errorBody = await response.text();
        try { errorBody = JSON.parse(errorBody); } catch { /* Ignora */ }
        console.error(`Erro HTTP da API Gemini: ${response.status} ${response.statusText}`, errorBody);
        throw new Error(`ERRO_API: HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      console.error("A API Gemini retornou um erro lógico:", data.error.message);
      throw new Error(`ERRO_API: ${data.error.message}`);
    }

    const outputText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!outputText) {
        console.error("Resposta inesperada da API (sem texto em 'candidates'):", JSON.stringify(data, null, 2));
        throw new Error("ERRO_FORMATO: Resposta inesperada da API");
    }

    console.log('[DEBUG] Texto JSON recebido da Gemini (análise completa):', outputText);

    const parsed = JSON.parse(outputText);

    if (!parsed || typeof parsed.sentimentoGeral !== 'string' || !Array.isArray(parsed.sentimentoPorSentenca)) {
       console.error("Formato JSON inesperado da Gemini (estrutura inválida):", parsed);
       throw new Error("ERRO_FORMATO: JSON da API inválido");
    }

    return parsed; // Retorna o objeto JSON completo

  } catch (err) {
    console.error(`Erro ao chamar ou processar a API Gemini para "${fullText.substring(0, 50)}...":`, err);
    throw err; // Relança o erro para o controller tratar
  }
}