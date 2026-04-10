export default function sentimentPhraseBreaker(text) {
  if (!text || typeof text !== 'string') return [];

  const textWithPunct = text
    .replace(/\[PONTO\]/gi, '.')
    .replace(/\[INTERROGACAO\]/gi, '?')
    .replace(/\[EXCLAMACAO\]/gi, '!')
    .replace(/\sMAS\s/gi, '. MAS ');

  const regex = /(?<=\.|\!|\?)\s+/g;
  const sentences = textWithPunct
    .split(regex)
    .map(s => s.replace(/[.!?]$/, '').trim()) 
    .filter(s => s.length > 0);

  return sentences;
}