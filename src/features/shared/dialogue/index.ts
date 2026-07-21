// The shared dialogue kit — one renderer + one streaming idiom for every
// conversational surface (docs/dialogue-design.md §III: unify the renderer,
// not the per-genre AIProvider methods).

export { Bubble, TypingPulse, Transcript } from './Transcript';
export { Composer } from './Composer';
export {
  useDialogueStream,
  consumeDialogueStream,
  dialogueInFlight,
  dialogueErrMessage,
} from './stream';
export type { RunTurnArgs, ConsumeCallbacks } from './stream';
