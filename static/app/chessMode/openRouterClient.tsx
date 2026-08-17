/**
 * Pawn Patrol — optional live coach.
 *
 * Grandmaster Seer ships with hand-written game reviews and those are the
 * default. If someone drops an OpenRouter API key into localStorage under
 * `pawn-patrol-openrouter-key`, we upgrade to a live-generated review instead.
 * There is no env plumbing here on purpose: this app runs as a pure-client SPA
 * with no backend, so localStorage is the only place a key can come from.
 *
 * This is the ONLY network call the chess-mode layer is allowed to make, and it
 * only happens when a key is present. Every failure path returns null so the
 * caller falls straight back to the canned review.
 */

const KEY_STORAGE_KEY = 'pawn-patrol-openrouter-key';
const MODEL_STORAGE_KEY = 'pawn-patrol-openrouter-model';
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.5';
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 25_000;

export interface CoachRootCause {
  five_whys: string[];
  one_line_description: string;
  reproduction_steps: string[];
}

export interface CoachSolution {
  one_line_summary: string;
  steps: Array<{description: string; title: string}>;
}

export interface CoachReview {
  /** Prose Seer "thinks out loud" with while a step is still running. */
  narration: {code_changes: string[]; root_cause: string[]; solution: string[]};
  rootCause: CoachRootCause;
  solution: CoachSolution;
}

export interface GameContext {
  /** Issue/game title, e.g. "Blunder: Qg5?? hung the queen — room A4V2EG". */
  title: string;
  /** Optional extra colour: culprit move, opening name, result. */
  culprit?: string;
  opening?: string;
  result?: string;
}

function readStorage(key: string): string | null {
  try {
    const value = window.localStorage.getItem(key);
    return value?.trim() ? value.trim() : null;
  } catch {
    // Private browsing / storage disabled.
    return null;
  }
}

export function getOpenRouterKey(): string | null {
  return readStorage(KEY_STORAGE_KEY);
}

export function hasOpenRouterKey(): boolean {
  return getOpenRouterKey() !== null;
}

function getModel(): string {
  return readStorage(MODEL_STORAGE_KEY) ?? DEFAULT_MODEL;
}

const SYSTEM_PROMPT = `You are Grandmaster Seer, the chess coach inside Pawn Patrol.
You review a finished chess game the way a debugger reviews a crash: find the one
move that actually lost the game, trace why the player made it, and hand back a
concrete plan for not repeating it.

Voice: precise, warm, a little dry. Never mock the player. Use real chess
vocabulary (tempo, prophylaxis, zugzwang, back rank, minority attack) but explain
any term you lean on. Moves in standard algebraic notation, wrapped in **bold**.

Respond with a single JSON object and nothing else — no prose, no code fences.
Schema:
{
  "rootCause": {
    "one_line_description": "1-2 sentences naming the losing move and what it cost. Markdown allowed.",
    "five_whys": ["5 strings, each one layer deeper: the material fact, the tactical miss, the thinking error, the clock/psychology, the preparation gap"],
    "reproduction_steps": ["4-6 strings walking the critical sequence move by move"]
  },
  "solution": {
    "one_line_summary": "1-2 sentences: what to play instead and why it holds.",
    "steps": [{"title": "short imperative", "description": "1-2 sentences"}]
  },
  "narration": {
    "root_cause": ["3-4 short first-person lines Seer says while analysing"],
    "solution": ["2-3 short first-person lines"],
    "code_changes": ["2-3 short first-person lines about editing the opening book"]
  }
}`;

function buildUserPrompt(game: GameContext): string {
  const details = [
    `Game: ${game.title}`,
    game.opening ? `Opening: ${game.opening}` : null,
    game.culprit ? `Suspect move: ${game.culprit}` : null,
    game.result ? `Result: ${game.result}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `${details}\n\nReview this game. Return only the JSON object.`;
}

/**
 * Models like to wrap JSON in ```json fences even when told not to. Strip them,
 * then fall back to the outermost {...} span.
 */
function parseJsonish(raw: string): any {
  const fenced = raw.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  try {
    return JSON.parse(fenced);
  } catch {
    // fall through
  }
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start === -1 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(fenced.slice(start, end + 1));
  } catch {
    return null;
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function coerceReview(value: any): CoachReview | null {
  const rootCause = value?.rootCause;
  const solution = value?.solution;

  if (typeof rootCause?.one_line_description !== 'string') {
    return null;
  }
  if (typeof solution?.one_line_summary !== 'string') {
    return null;
  }

  const steps = Array.isArray(solution.steps)
    ? solution.steps
        .filter(
          (step: any) =>
            typeof step?.title === 'string' && typeof step?.description === 'string'
        )
        .map((step: any) => ({title: step.title, description: step.description}))
    : [];

  if (!steps.length) {
    return null;
  }

  const narration = value?.narration ?? {};

  return {
    rootCause: {
      one_line_description: rootCause.one_line_description,
      five_whys: isStringArray(rootCause.five_whys) ? rootCause.five_whys : [],
      reproduction_steps: isStringArray(rootCause.reproduction_steps)
        ? rootCause.reproduction_steps
        : [],
    },
    solution: {
      one_line_summary: solution.one_line_summary,
      steps,
    },
    narration: {
      root_cause: isStringArray(narration.root_cause) ? narration.root_cause : [],
      solution: isStringArray(narration.solution) ? narration.solution : [],
      code_changes: isStringArray(narration.code_changes) ? narration.code_changes : [],
    },
  };
}

/**
 * Ask OpenRouter for a live game review.
 *
 * Returns null — never throws — when no key is configured, the request fails,
 * times out, or the model returns something we can't read. Callers treat null as
 * "use the canned review".
 */
export async function generateCoachReview(
  game: GameContext
): Promise<CoachReview | null> {
  const apiKey = getOpenRouterKey();
  if (!apiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Pawn Patrol',
      },
      body: JSON.stringify({
        model: getModel(),
        temperature: 0.7,
        messages: [
          {role: 'system', content: SYSTEM_PROMPT},
          {role: 'user', content: buildUserPrompt(game)},
        ],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      return null;
    }

    return coerceReview(parseJsonish(content));
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}
