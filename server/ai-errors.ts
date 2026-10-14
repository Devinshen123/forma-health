export type AiErrorCode = 'AI_NOT_CONFIGURED' | 'AI_CONFIG_INVALID' | 'AI_CONSENT_REQUIRED' | 'AI_RATE_LIMIT' | 'AI_BUDGET_LIMIT' | 'AI_TIMEOUT' | 'AI_UNAVAILABLE' | 'AI_INVALID_OUTPUT' | 'AI_REFUSED' | 'AI_IMAGE_INVALID';
const failures: Record<AiErrorCode, [number, string]> = {
  AI_NOT_CONFIGURED: [503, 'Food photo analysis is not configured. Use manual entry.'],
  AI_CONFIG_INVALID: [503, 'Food photo analysis configuration is invalid. Use manual entry.'],
  AI_CONSENT_REQUIRED: [400, 'Consent is required before sending this photo for analysis.'],
  AI_RATE_LIMIT: [429, 'Too many photo requests or another analysis is in progress. Try again later.'],
  AI_BUDGET_LIMIT: [429, 'The daily photo analysis allowance has been reached. Use manual entry.'],
  AI_TIMEOUT: [504, 'Photo analysis timed out. Use manual entry or try again later.'],
  AI_UNAVAILABLE: [502, 'The photo analysis provider is unavailable. Use manual entry.'],
  AI_INVALID_OUTPUT: [502, 'Photo analysis returned an invalid draft. Use manual entry.'],
  AI_REFUSED: [422, 'The provider could not analyze this photo. Use manual entry.'],
  AI_IMAGE_INVALID: [400, 'Use a valid JPEG, PNG or WebP photo up to 5 MB and 20 megapixels.'],
};
export class AiError extends Error {
  readonly status: number;
  constructor(readonly code: AiErrorCode) { super(failures[code][1]); this.status = failures[code][0]; }
}
