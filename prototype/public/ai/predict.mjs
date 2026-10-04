// Dependency-free inference. This module uses no network and works in JS browsers/Node.
export function normalize(text, maxCharacters = 320) {
  return String(text).normalize('NFKD').replace(/[^\x00-\x7F]/g, '')
    .toLowerCase().replace(/[ \t\n\r\f\v]+/g, ' ').trim().slice(0, maxCharacters);
}

export class HarvestIntentModel {
  constructor(metadata, vocabulary, weightsBuffer) {
    if (metadata.format !== 'harvestlink-intent-f32-v1') throw new Error('Unsupported format');
    this.metadata = metadata;
    this.vocabulary = new Map(vocabulary.map((token, index) => [token, index]));
    const expected = metadata.labels.length * metadata.featureCount;
    if (weightsBuffer.byteLength !== expected * 4) throw new Error('Wrong weight length');
    if (vocabulary.length !== metadata.featureCount) throw new Error('Wrong vocabulary length');
    const view = new DataView(weightsBuffer);
    this.weights = new Float32Array(expected);
    for (let i = 0; i < expected; i++) this.weights[i] = view.getFloat32(i * 4, true);
  }

  predict(text) {
    const clean = normalize(text, this.metadata.maxCharacters);
    const padded = '^' + clean + '$';
    const indices = new Set();
    for (let n = this.metadata.ngrams[0]; n <= this.metadata.ngrams[1]; n++) {
      for (let i = 0; i + n <= padded.length; i++) {
        const index = this.vocabulary.get(padded.slice(i, i + n));
        if (index !== undefined) indices.add(index);
      }
    }
    const scores = this.metadata.intercepts.map((bias, labelIndex) => {
      let score = bias;
      const offset = labelIndex * this.metadata.featureCount;
      for (const index of indices) score += this.weights[offset + index];
      return score;
    });
    const maxScore = Math.max(...scores);
    const exponentials = scores.map(score => Math.exp(score - maxScore));
    const denominator = exponentials.reduce((a, b) => a + b, 0);
    const probabilities = exponentials.map(v => v / denominator);
    const ranking = probabilities.map((score, index) => ({score, index}))
      .sort((a, b) => b.score - a.score);
    const gate = this.metadata.clarificationGate;
    const margin = ranking[0].score - ranking[1].score;
    return {
      intent: this.metadata.labels[ranking[0].index],
      confidenceScore: ranking[0].score, // Uncalibrated, not a reliability guarantee.
      needsClarification: clean.length === 0 || ranking[0].score < gate.minScore ||
        margin < gate.minMargin || indices.size < gate.minMatchedFeatures,
      matchedFeatures: indices.size,
      scores,
      normalizedText: clean,
    };
  }
}
