import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { Stt, Tts } from "./port.js";

/**
 * `rl.question()` doesn't play well with fully piped stdin (all lines land
 * before the first question() call resolves), so this iterates the input
 * stream directly and prints the "you>" prompt itself for interactive use.
 */
export class TextStt implements Stt {
  private lines: AsyncIterator<string>;

  constructor() {
    const rl = createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });
    this.lines = rl[Symbol.asyncIterator]();
  }

  async listen(): Promise<string | null> {
    if (stdin.isTTY) stdout.write("you> ");
    const { value, done } = await this.lines.next();
    if (done || value === undefined) return null;
    if (value.trim().toLowerCase() === "/exit") return null;
    return value;
  }

  close(): void {
    // readline closes automatically when its input stream ends.
  }
}

export class TextTts implements Tts {
  async speak(text: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`agent> ${text}`);
  }
}
