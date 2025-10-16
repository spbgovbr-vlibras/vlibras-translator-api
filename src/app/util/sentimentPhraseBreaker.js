export default function sentimentPhraseBreaker(text) {
  if (!text || typeof text !== 'string') return [];

  const trimmed = text.trim();

  const regex = /(?<!\b(?:Dr|Sr|Sra|Prof|Ex)\.)(?<=\.|\!|\?)\s+/gi;

  const sentences = trimmed.split(regex).map(s => s.trim()).filter(s => s.length > 0);

  return sentences;
}
