// Token estimate used wherever the transcript stores no per-block count.
export const estimateTokens = (chars: number): number => Math.max(1, Math.ceil(chars / 4))
