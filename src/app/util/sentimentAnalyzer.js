
export default async function sentimentAnalyzer(text) {
  const prompt = `Analise o sentimento do seguinte texto e classifique como uma das categorias:
  feliz, medo, raiva, surpresa, tristeza ou neutro.
  Texto: "${text}"`;

  console.log('📤 Enviando prompt para DeepSeek (simulação):', prompt);

  const lower = text.toLowerCase();

  if (/\b(feliz|alegre|ótimo|bom|maravilhoso|satisfeito)\b/.test(lower)) return 'feliz';
  if (/\b(medo|receio|assustado|ansioso|apreensivo)\b/.test(lower)) return 'medo';
  if (/\b(raiva|irritado|furioso|ódio|zangado)\b/.test(lower)) return 'raiva';
  if (/\b(surpres[ao]|chocado|impressionado)\b/.test(lower)) return 'surpresa';
  if (/\b(triste|deprimido|infeliz|abatido)\b/.test(lower)) return 'tristeza';

  return 'neutro';
}
