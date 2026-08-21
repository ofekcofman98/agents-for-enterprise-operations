/**
 * Speech ports. Task.md explicitly allows text simulating a transcript for
 * the core build, so textAdapter.ts is the only implementation for now —
 * swapping in real STT/TTS means implementing these two interfaces.
 */
export interface Stt {
  listen(): Promise<string | null>; // null = end of input
}

export interface Tts {
  speak(text: string): Promise<void>;
}
