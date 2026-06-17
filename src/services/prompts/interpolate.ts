// Central template-variable interpolation for prompts. Two distinct mechanisms
// live in this codebase and are deliberately kept separate:
//
//   1. Token substitution ({{TOKEN}}) — what this file handles. Used by prompts
//      that declare `variables` in the registry (e.g. suggestDirectivesTemplate).
//   2. Structural assembly — concatenating an editable base instruction with
//      runtime-formatted context (e.g. buildDiagnosticPrompt in lib/constants).
//      That is NOT token substitution and is not routed through here.

import { getPromptEntry } from './registry';

const TOKEN_RE = /\{\{(\w+)\}\}/g;

/**
 * Replace every `{{TOKEN}}` in `template` with `values[TOKEN]`. A single global
 * pass, so *all* occurrences of a token are replaced (the old chained-`.replace`
 * approach only replaced the first). Throws if the template references a token
 * with no supplied value — fail loud rather than ship a literal `{{TOKEN}}`.
 */
export function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(TOKEN_RE, (_match, token: string) => {
    if (!(token in values)) {
      throw new Error(`interpolate: no value supplied for {{${token}}}`);
    }
    return values[token];
  });
}

/**
 * Render a registered prompt by key: validate that every declared *required*
 * variable is supplied, then interpolate. Use this for prompts that carry
 * `variables` metadata so the contract is machine-checked, not implicit.
 */
export function renderPrompt(key: string, values: Record<string, string>): string {
  const entry = getPromptEntry(key);
  for (const variable of entry.variables) {
    if (variable.required && !(variable.token in values)) {
      throw new Error(`renderPrompt(${key}): missing required variable {{${variable.token}}}`);
    }
  }
  return interpolate(entry.defaultText, values);
}
