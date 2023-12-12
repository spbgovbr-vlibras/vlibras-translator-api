function PhraseBreaker(phrases) {
  return phrases.trim().split('.').filter(s => s);
}

export default PhraseBreaker;
