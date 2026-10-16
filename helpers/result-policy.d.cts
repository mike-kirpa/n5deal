export function classifyResult(input: { cleanupFailure?: boolean; infrastructureFailure?: boolean; environmentFailure?: boolean; expectedStatus: string; status: string }): string;
export function expirationOutcome(expiredStatus: number, controlStatus: number, controlMatches: boolean): 'inconclusive' | 'denied' | 'accessible';
