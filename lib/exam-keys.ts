// SERVER ONLY. Answer key for the final exams. Never import this from a client component:
// it would send the answers to the browser. Generated from lib/courses-data.ts.

export type ExamKey = Record<number, { correctIndex: number; explanation: string }>;

export const EXAM_KEYS: Record<string, ExamKey> = {
  "prompt-engineering": {
    "1": {
      "correctIndex": 0,
      "explanation": "Delimiting untrusted content with explicit XML tags (like <resume_content>) combined with clear system instructions to treat tag contents strictly as inert data is Anthropic's recommended standard defense."
    },
    "2": {
      "correctIndex": 1,
      "explanation": "Chain-of-thought elicitation allows the model to compute intermediate reasoning steps on the context canvas before committing to a final conclusion."
    },
    "3": {
      "correctIndex": 0,
      "explanation": "Assistant prefill with '{' guarantees the model starts directly inside the JSON object, preventing any preceding conversational markdown fences."
    },
    "4": {
      "correctIndex": 1,
      "explanation": "In-context examples communicate nuanced stylistic, syntactic, and structural expectations with clarity that purely declarative guidelines cannot match."
    },
    "5": {
      "correctIndex": 0,
      "explanation": "Enforcing quotes-first citation and providing a clear, explicit path to decline answering when facts are absent is the proven method to eliminate hallucinations."
    }
  },
  "anthropic-api": {
    "1": {
      "correctIndex": 0,
      "explanation": "Claude supports parallel tool execution. You should execute each requested tool and return a single user message containing all corresponding `tool_result` blocks referencing their respective `tool_use_id`s."
    },
    "2": {
      "correctIndex": 0,
      "explanation": "Anthropic's prompt caching API requires specifying `cache_control: { type: 'ephemeral' }` on the designated block."
    },
    "3": {
      "correctIndex": 1,
      "explanation": "Exposing structured error details back to the model enables autonomous self-correction and intelligent fallback handling."
    },
    "4": {
      "correctIndex": 0,
      "explanation": "The Message Batches API cuts costs by 50% for non-realtime, high-volume asynchronous jobs."
    },
    "5": {
      "correctIndex": 0,
      "explanation": "In the Anthropic streaming protocol, text chunks arrive in `content_block_delta` events where `event.delta.type === 'text_delta'` and `event.delta.text` contains the string token."
    }
  },
  "ai-workflow-design": {
    "1": {
      "correctIndex": 1,
      "explanation": "In MCP, Resources provide readable context and data to the model, while Tools are executable functions with inputs and outputs that can cause side effects."
    },
    "2": {
      "correctIndex": 1,
      "explanation": "The Evaluator-Optimizer pattern separates generation from verification, iteratively improving quality until passing thresholds are attained."
    },
    "3": {
      "correctIndex": 1,
      "explanation": "Unrestricted execution creates critical vulnerabilities. Agents must always operate with scoped, least-privilege tools in sandboxed environments."
    },
    "4": {
      "correctIndex": 1,
      "explanation": "MCP serves as a universal adapter, allowing developers to write context and tool servers once and connect them across any compliant host application."
    },
    "5": {
      "correctIndex": 1,
      "explanation": "Human-in-the-loop verification ensures critical actions require human authorization before execution."
    }
  },
  "foundations": {
    "1": {
      "correctIndex": 0,
      "explanation": "Constitutional AI establishes a set of explicit written principles that guide the model during automated self-evaluation and alignment training."
    },
    "2": {
      "correctIndex": 1,
      "explanation": "Anthropic's commercial terms provide a strict guarantee that customer data is never used to train public or proprietary foundation models."
    },
    "3": {
      "correctIndex": 1,
      "explanation": "Claude 3.5 Haiku offers sub-second latency and ultra-low cost, making it ideal for high-volume classification and tagging."
    },
    "4": {
      "correctIndex": 1,
      "explanation": "Anthropic's foundational alignment framework focuses on creating AI that is Helpful, Honest, and Harmless."
    },
    "5": {
      "correctIndex": 1,
      "explanation": "Claude is tuned to minimize false-positive refusals, providing helpful and objective educational explanations while refusing dangerous or harmful exploits."
    }
  }
};

/** Share of correct answers needed to pass. */
export const PASS_MARK = 0.8;
