// Phase 3.5 — AI provider registry / dependency injection point.
//
// Picks the active AIProvider at module load. Today the only impl is Gemini,
// but the indirection is what lets components and slices stay ignorant of
// the SDK. Mirrors `repository-registry.ts` deliberately — one concern, one
// registry, frozen for the session.
//
// API key sourcing: `vite.config.ts` defines both `process.env.API_KEY` and
// `process.env.GEMINI_API_KEY` from the same underlying `GEMINI_API_KEY`
// .env entry. We pick `API_KEY` as the canonical name here.
// When OS-keyring storage lands (originally a Phase 3 deliverable that
// didn't ship; deferred to Phase 4 alongside sync credentials), only this
// file changes — consumers continue importing `aiProvider`.

import { GeminiProvider } from './gemini-provider';
import type { AIProvider } from './ai-provider';

const apiKey = process.env.API_KEY || '';

export const aiProvider: AIProvider = new GeminiProvider(apiKey);
