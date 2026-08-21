import "dotenv/config";
import "./tools/bank.readTools.js";
import "./tools/bank.writeTools.js";
import { createSession } from "./session.js";
import { handleTurn } from "./orchestrator/orchestrator.js";
import { TextStt, TextTts } from "./voice/textAdapter.js";
import { AnthropicClient } from "./llm/anthropic.js";
import { FakeLlmClient } from "./llm/fake.js";
import type { LlmClient } from "./llm/client.js";

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const llm: LlmClient = apiKey ? new AnthropicClient(apiKey) : new FakeLlmClient();
  if (!apiKey) {
    console.log("No ANTHROPIC_API_KEY set — using the deterministic fake LLM client.\n");
  }

  const session = createSession("cust-1");
  const stt = new TextStt();
  const tts = new TextTts();

  console.log("Meridian Bank voice agent (text mode). Type /exit to quit.\n");

  while (true) {
    const input = await stt.listen();
    if (input === null) break;
    if (!input.trim()) continue;

    const reply = await handleTurn(llm, session, input);
    await tts.speak(reply);
  }

  stt.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
