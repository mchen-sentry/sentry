/**
 * Pawn Patrol — Grandmaster Seer.
 *
 * Stubs the Seer/autofix endpoints the issue-detail Seer drawer talks to, so
 * opening the drawer on any game produces a full coach review instead of a
 * dead panel. The wire shapes here mirror the real explorer-mode autofix API
 * (see `useExplorerAutofix.tsx`): a run is a flat list of blocks, each block
 * optionally carrying an artifact, grouped into sections by `message.metadata.step`.
 *
 * Progression is simulated off wall-clock time. A step starts "processing" with
 * Seer narrating, then flips to "completed" with its artifact attached. The
 * drawer polls once a second while anything is processing, so this reads as a
 * live analysis without any timers of our own.
 *
 * Review content is canned by default. If an OpenRouter key is present the
 * first poll kicks off a live generation and the run stays in "processing"
 * until it lands (falling back to canned on any failure).
 */

import {
  generateCoachReview,
  hasOpenRouterKey,
  type CoachReview,
} from 'sentry/chessMode/openRouterClient';

type ChessRoute = {
  handler: (url: string, options: any) => any;
  url: RegExp;
  method?: string;
};

/** Hand-written reviews, used unless a live OpenRouter coach is configured. */
interface CannedReview extends CoachReview {
  /** Unified diff shown in the "code changes" step, as an opening-book edit. */
  patch: {
    added: number;
    hunks: any[];
    path: string;
    removed: number;
    title: string;
  };
}

const REVIEWS: CannedReview[] = [
  {
    rootCause: {
      one_line_description:
        'You played **12. Qg5??** chasing a mating net that was two tempi away from existing. After **12... h6** the queen has no square that keeps any threat alive, and White is a queen down for a pawn by move 14.',
      five_whys: [
        'The material loss is direct: after **12. Qg5?? h6 13. Qh4 g5 14. Qg3 Bf5**, the queen is trapped on an open board with no discovered threat to bail her out.',
        'The queen went to g5 because you were counting on the knight on f6 being pinned — but that knight was recaptured on move 10, so the pin had already stopped existing.',
        'The stale pin survived because you evaluated the position once, around move 8, and kept re-using that evaluation instead of re-reading the board each move.',
        'You re-used it because the clock was at 2:14 and you were playing your plan rather than the position — the standard failure mode of a blitz attack that has gone one move past its expiry.',
        'The plan was overweighted from the start. A quiet Italian setup does not produce a forced mating attack by move 12, so any line that promised one should have been treated as suspicious before it was trusted.',
      ],
      reproduction_steps: [
        '**1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6** — a normal, slightly slow Italian. Nothing is wrong yet.',
        '**6. Bg5** pins the f6-knight. This is the pin your whole attack later leans on.',
        '**10. Bxf6 Qxf6** — you trade the bishop off. The pin is gone from here on; the plan built on it is not.',
        '**12. Qg5??** enters looking for Qxg7#. Black has **12... h6**, hitting the queen and defending g7 in one move.',
        '**13. Qh4 g5 14. Qg3 Bf5** — every retreat square is covered. The queen falls next move.',
        'Black converts a queen-for-pawn advantage without further incident; resignation on move 27.',
      ],
    },
    solution: {
      one_line_summary:
        'Play **12. Nd5** instead. It keeps the initiative with a real threat (the fork on c7/e7), gains a tempo on the queen, and leaves your own queen on a square where she is not the most valuable piece on an open file.',
      steps: [
        {
          title: 'Re-check the pin before every move that depends on it',
          description:
            'A pin is a property of the current position, not a fact about the game. The moment the pinning piece is traded, delete the plan that assumed it.',
        },
        {
          title: 'Play 12. Nd5 and take the free tempo',
          description:
            'The knight hits the queen on f6 and eyes c7. Black spends a move dealing with it, and you improve for free — the definition of initiative.',
        },
        {
          title: 'Never move the queen to a square a pawn can attack',
          description:
            'Before committing the queen, check every enemy pawn that can reach her in one move. On g5 that was h6 and it was available immediately.',
        },
        {
          title: 'Budget clock time for the moment the position changes',
          description:
            'Move 10 was the trade, and the trade was the moment your plan died. Spend thirty seconds at structural changes and play the quiet moves quickly instead.',
        },
      ],
    },
    narration: {
      root_cause: [
        'Loading the game score and the clock trace. 34 moves, blitz time control, one decisive swing.',
        'Evaluation is flat until move 12, then it drops nine points in a single ply. That is the move.',
        'Checking why **Qg5** looked playable — tracing the tactical justification backwards through the game.',
        'Found it. The pin on f6 was traded off on move 10. The attack was running on stale state.',
      ],
      solution: [
        'Looking for a move on 12 that keeps the initiative without hanging material.',
        'Comparing **12. Nd5**, **12. Re1**, and **12. h3**. Nd5 is the only one that gains a tempo.',
      ],
      code_changes: [
        'Opening the repertoire file for the Italian Game.',
        'Adding a stop note at move 10 so the trade gets flagged next time.',
      ],
    },
    patch: {
      path: 'openings/italian-game.pgn',
      title: 'Flag the move-10 trade in the Italian repertoire',
      added: 4,
      removed: 1,
      hunks: [
        {
          section_header: '[Event "Repertoire: Italian Game, Giuoco Pianissimo"]',
          source_start: 12,
          source_length: 6,
          target_start: 12,
          target_length: 9,
          lines: [
            {
              value: '6. Bg5 h6 7. Bh4 g5 8. Bg3 Bg4 9. Nbd2 Nd7',
              line_type: ' ',
              diff_line_no: 1,
              source_line_no: 12,
              target_line_no: 12,
            },
            {
              value: '{ Plan: build the battery and look for Qg5 with the f6 pin. }',
              line_type: '-',
              diff_line_no: 2,
              source_line_no: 13,
              target_line_no: null,
            },
            {
              value:
                '{ Plan: build the battery ONLY while the f6 pin is still on the board. }',
              line_type: '+',
              diff_line_no: 3,
              source_line_no: null,
              target_line_no: 13,
            },
            {
              value:
                '{ STOP: if the dark-squared bishop is traded, the mating net is off. }',
              line_type: '+',
              diff_line_no: 4,
              source_line_no: null,
              target_line_no: 14,
            },
            {
              value: '{ Re-evaluate from scratch. Prefer Nd5 for the tempo. }',
              line_type: '+',
              diff_line_no: 5,
              source_line_no: null,
              target_line_no: 15,
            },
            {
              value: '',
              line_type: '+',
              diff_line_no: 6,
              source_line_no: null,
              target_line_no: 16,
            },
            {
              value: '10. Bxf6 Qxf6 11. O-O O-O-O',
              line_type: ' ',
              diff_line_no: 7,
              source_line_no: 14,
              target_line_no: 17,
            },
          ],
        },
      ],
    },
  },
  {
    rootCause: {
      one_line_description:
        'You did not lose this on the board — you lost it on the clock. The rook endgame after move 41 is winning by roughly four pawns of evaluation, and you spent 1:48 of a 2:03 remainder on **48. Kf3**, a move that changes nothing.',
      five_whys: [
        'The game ended by time forfeit on move 52 in a position where **Rb7+** followed by pushing the a-pawn wins on the spot.',
        'The clock ran out because moves 44 through 51 averaged 14 seconds each in a position that needed two: the technique was already decided by move 43.',
        'You spent that time re-verifying a win you had already calculated, because a winning position raised the cost of being wrong and you started checking instead of playing.',
        'Checking replaced playing because you had no concrete plan to execute — you knew you were winning but had not named the winning method, so every move was a fresh search.',
        'You had not named the method because your endgame study is pattern-light: you can recognise a winning rook endgame but you have not drilled the Lucena position to the point where it plays itself.',
      ],
      reproduction_steps: [
        'Position after **41... Rd2**: rook and three pawns each, your a-pawn passed and on a5, king active on e4. Engine gives roughly +4.1.',
        '**42. Ra1 Rd7 43. a6 Ra7** — the standard setup. Black is now purely passive; the win is a matter of technique.',
        '**44. Kd5** (0:31) — fine, but the clock is already leaking.',
        '**48. Kf3** (1:48) — the longest think of the game, in a position with one plan and no opponent counterplay.',
        '**52. Rb1** with 0:04 left. Flag falls before the move after it.',
        'Final position remains winning for White at the moment of forfeit.',
      ],
    },
    solution: {
      one_line_summary:
        'Convert with the Lucena bridge and nothing else: get the rook to the seventh, walk the king to the pawn, build the bridge on the fourth rank. Naming the method once removes the need to recalculate it every move.',
      steps: [
        {
          title: 'Learn the Lucena position until it is reflex',
          description:
            'Rook pawn on the seventh, king in front, bridge on the fourth rank. It is roughly ten minutes of drilling and it converts an entire class of endgame without thought.',
        },
        {
          title: 'Set a per-move budget once you are winning',
          description:
            'In a technically won endgame, cap yourself at ten seconds a move unless the position genuinely changes. Being winning is a reason to move faster, not slower.',
        },
        {
          title: 'Trade pieces, not pawns, when ahead',
          description:
            'You had chances to trade rooks on move 45 into a trivially won king-and-pawn ending. Simplification is the cheapest form of technique.',
        },
        {
          title: 'Stop recalculating a decided plan',
          description:
            'Once you have verified a winning method, execute it. Re-deriving it every move costs clock and introduces the only real risk left in the position.',
        },
      ],
    },
    narration: {
      root_cause: [
        'Reading the game score alongside the per-move clock trace.',
        'Evaluation never goes below +3.8 after move 41. This is not a positional collapse.',
        'Clock trace shows 1:48 on a single quiet move at 48. Correlating with the position.',
        'Confirmed: the losing resource was time, not material. Analysing why the clock went.',
      ],
      solution: [
        'Checking which standard endgame method applies here.',
        'It is a textbook Lucena. Writing the conversion as a sequence rather than a calculation.',
      ],
      code_changes: [
        'Opening the endgame drill file.',
        'Adding the Lucena bridge to the daily rotation with a time cap.',
      ],
    },
    patch: {
      path: 'drills/endgames.yaml',
      title: 'Add the Lucena bridge to the daily drill rotation',
      added: 5,
      removed: 0,
      hunks: [
        {
          section_header: 'daily:',
          source_start: 8,
          source_length: 4,
          target_start: 8,
          target_length: 9,
          lines: [
            {
              value: '  - name: king-and-pawn-opposition',
              line_type: ' ',
              diff_line_no: 1,
              source_line_no: 8,
              target_line_no: 8,
            },
            {
              value: '    reps: 5',
              line_type: ' ',
              diff_line_no: 2,
              source_line_no: 9,
              target_line_no: 9,
            },
            {
              value: '  - name: lucena-bridge',
              line_type: '+',
              diff_line_no: 3,
              source_line_no: null,
              target_line_no: 10,
            },
            {
              value: '    reps: 10',
              line_type: '+',
              diff_line_no: 4,
              source_line_no: null,
              target_line_no: 11,
            },
            {
              value: '    time_cap_seconds: 10  # if it takes longer, it is not learned',
              line_type: '+',
              diff_line_no: 5,
              source_line_no: null,
              target_line_no: 12,
            },
            {
              value: '  - name: philidor-defence',
              line_type: '+',
              diff_line_no: 6,
              source_line_no: null,
              target_line_no: 13,
            },
            {
              value: '    reps: 10',
              line_type: '+',
              diff_line_no: 7,
              source_line_no: null,
              target_line_no: 14,
            },
            {
              value: '  - name: rook-behind-passer',
              line_type: ' ',
              diff_line_no: 8,
              source_line_no: 10,
              target_line_no: 15,
            },
          ],
        },
      ],
    },
  },
  {
    rootCause: {
      one_line_description:
        'You walked into the Fried Liver by playing **5... Nxd5??**. The knight sacrifice **6. Nxf7** is not a trap you needed to see coming at the board — it is the entire point of the line, and it is 300 years old.',
      five_whys: [
        'After **6. Nxf7 Kxf7 7. Qf3+ Ke6 8. Nc3**, your king is on e6 on move 8 with the centre open. That position is objectively lost against anyone who has seen it once.',
        'You played **5... Nxd5** because recapturing looked like the natural, material-restoring move, and it was the only capture you looked at.',
        'It was the only capture you looked at because you were following a general principle ("take back the pawn") rather than a concrete line, and general principles stop working in sharp openings.',
        'You reached for the principle because you had no preparation past move 4 in the Two Knights — the position left your book and you improvised in the sharpest line on the board.',
        'You had no preparation there because your repertoire covers the openings you enjoy rather than the openings you actually face, and the Italian/Two Knights is the most common reply you meet.',
      ],
      reproduction_steps: [
        '**1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6** — the Two Knights Defence. Sharp, and you are already out of book.',
        '**4. Ng5** — the move that announces the Fried Liver. Black must know this position, not work it out.',
        '**4... d5 5. exd5** — the critical moment. Black has **5... Na5** (the main line), **5... b5** (the Ulvestad), or **5... Nd4** (the Fritz).',
        '**5... Nxd5??** — the one move that loses. It leaves f7 defended only by the king.',
        '**6. Nxf7! Kxf7 7. Qf3+ Ke6 8. Nc3** — the king is dragged to e6 and cannot get home.',
        'Black holds out to move 24 but has been lost since move 8.',
      ],
    },
    solution: {
      one_line_summary:
        'Play **5... Na5**, the main line. It hits the bishop on c4, gets the knight out of the fork, and gives back a pawn for a comfortable game — Black is fine here and has been for centuries.',
      steps: [
        {
          title: 'Memorise 5... Na5 as a single unit',
          description:
            'Not "a move to consider" — the move. In sharp openings, one memorised reply beats five minutes of calculation.',
        },
        {
          title: 'Know the follow-up, not just the move',
          description:
            'After **6. Bb5+ c6 7. dxc6 bxc6 8. Be2 h6 9. Nf3 e4**, Black has the initiative for the pawn. Learn to move 10 so you are not improvising one move later.',
        },
        {
          title: 'Build the repertoire from what you actually face',
          description:
            'Pull your last hundred games, count the openings by frequency, and prepare in that order. The Two Knights is likely your most common position and your least prepared one.',
        },
        {
          title: 'Treat "obvious recapture" as a warning sign',
          description:
            'In a line where a piece is aimed at f7, the natural move is exactly the one your opponent prepared for. Slow down when a capture looks forced.',
        },
      ],
    },
    narration: {
      root_cause: [
        'Reading the game score. Twenty-four moves, and the evaluation is decided by move 8.',
        'This is a known theoretical position — checking it against the opening book rather than calculating.',
        'Book match: the Fried Liver Attack, first recorded in the 1600s. The refutation is at move 5.',
        'Tracing why the losing recapture was chosen over the two book alternatives.',
      ],
      solution: [
        'The fix here is preparation, not calculation. Pulling the main line.',
        '**5... Na5** is the move, and it needs four moves of follow-up to be usable.',
      ],
      code_changes: [
        'Opening the Black repertoire against 1. e4.',
        'Adding the Two Knights main line with the follow-up through move 10.',
      ],
    },
    patch: {
      path: 'openings/black-vs-e4.pgn',
      title: 'Add the Two Knights main line against the Fried Liver',
      added: 6,
      removed: 1,
      hunks: [
        {
          section_header: '[Event "Repertoire: Two Knights Defence"]',
          source_start: 4,
          source_length: 4,
          target_start: 4,
          target_length: 9,
          lines: [
            {
              value: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5',
              line_type: ' ',
              diff_line_no: 1,
              source_line_no: 4,
              target_line_no: 4,
            },
            {
              value: '5... Nxd5 { natural recapture }',
              line_type: '-',
              diff_line_no: 2,
              source_line_no: 5,
              target_line_no: null,
            },
            {
              value: '5... Na5! { the main line — never Nxd5, which loses to 6. Nxf7 }',
              line_type: '+',
              diff_line_no: 3,
              source_line_no: null,
              target_line_no: 5,
            },
            {
              value: '6. Bb5+ c6 7. dxc6 bxc6 8. Be2 h6 9. Nf3 e4 10. Ne5 Bd6',
              line_type: '+',
              diff_line_no: 4,
              source_line_no: null,
              target_line_no: 6,
            },
            {
              value: '{ Black is a pawn down with the initiative and an easy game. }',
              line_type: '+',
              diff_line_no: 5,
              source_line_no: null,
              target_line_no: 7,
            },
            {
              value: '',
              line_type: '+',
              diff_line_no: 6,
              source_line_no: null,
              target_line_no: 8,
            },
            {
              value: '{ Drill this to move 10 before playing 1... e5 again. }',
              line_type: '+',
              diff_line_no: 7,
              source_line_no: null,
              target_line_no: 9,
            },
            {
              value: '*',
              line_type: ' ',
              diff_line_no: 8,
              source_line_no: 6,
              target_line_no: 10,
            },
          ],
        },
      ],
    },
  },
];

const REPO_NAME = 'pawn-patrol/repertoire';

type StepName = 'root_cause' | 'solution' | 'code_changes';

/** How long a step "thinks" before its artifact appears. */
const STEP_DURATION_MS: Record<StepName, number> = {
  root_cause: 4200,
  solution: 3400,
  code_changes: 3800,
};

/** How long a narration line stays on screen before the next one appears. */
const NARRATION_INTERVAL_MS = 950;

/** How long a pull request spends in the "creating" state. */
const PR_DURATION_MS = 3000;

interface StepState {
  name: StepName;
  startedAt: number;
  userContext?: string;
}

interface RunState {
  cannedIndex: number;
  /** Set once the live generation has been kicked off, so we only ask once. */
  liveRequested: boolean;
  prCreatedAt: number | null;
  /** Resolved review content. Null while a live generation is still in flight. */
  review: CannedReview | null;
  runId: number;
  steps: StepState[];
}

const runs = new Map<string, RunState>();
let nextRunId = 4100;

/** Stable per-issue pick so the same game always gets the same review. */
function pickReviewIndex(issueId: string): number {
  let hash = 0;
  for (let i = 0; i < issueId.length; i++) {
    hash = (hash * 31 + issueId.charCodeAt(i)) >>> 0;
  }
  return hash % REVIEWS.length;
}

function getRun(issueId: string): RunState | undefined {
  return runs.get(issueId);
}

function createRun(issueId: string): RunState {
  const cannedIndex = pickReviewIndex(issueId);
  const run: RunState = {
    runId: nextRunId++,
    cannedIndex,
    steps: [],
    prCreatedAt: null,
    review: null,
    liveRequested: false,
  };
  runs.set(issueId, run);
  return run;
}

/**
 * Resolve the review content for a run.
 *
 * No key configured: the canned review is used immediately. Key configured: we
 * fire one OpenRouter request and leave `review` null until it settles, which
 * keeps the run in its "processing" state (and therefore polling) meanwhile.
 * Any failure falls back to the same canned review.
 */
function ensureReview(run: RunState) {
  if (run.review || run.liveRequested) {
    return;
  }

  const canned = REVIEWS[run.cannedIndex]!;

  if (!hasOpenRouterKey()) {
    run.review = canned;
    return;
  }

  run.liveRequested = true;
  generateCoachReview({title: currentGameTitle()})
    .then(live => {
      run.review = live
        ? {
            ...canned,
            rootCause: live.rootCause,
            solution: live.solution,
            narration: live.narration,
          }
        : canned;
    })
    .catch(() => {
      run.review = canned;
    });
}

/**
 * Best-effort context for the live coach. The autofix request carries no game
 * title, but the issue-detail page has already put it in the document title, so
 * we read it from there. If that fails the prompt still works — the model just
 * gets less to go on.
 */
function currentGameTitle(): string {
  const title = document.title.split(' — ')[0]?.trim();
  return title && title !== 'Pawn Patrol' ? title : 'A blitz game that went wrong';
}

const CLOSING_LINE: Record<StepName, string> = {
  root_cause: 'Analysis complete. Here is what actually decided the game.',
  solution: 'Here is the plan I would drill before your next game.',
  code_changes: 'Repertoire updated. Review the change before you commit it.',
};

function narrationFor(review: CannedReview, step: StepName): string[] {
  return review.narration[step] ?? [];
}

function buildStepBlocks(run: RunState, step: StepState, now: number): any[] {
  const review = run.review;
  const elapsed = now - step.startedAt;
  const done = review !== null && elapsed >= STEP_DURATION_MS[step.name];
  const timestamp = new Date(step.startedAt).toISOString();
  const blocks: any[] = [];

  const lines = review ? narrationFor(review, step.name) : [];
  const revealCount = done
    ? lines.length
    : Math.min(lines.length, Math.floor(elapsed / NARRATION_INTERVAL_MS) + 1);

  for (let i = 0; i < revealCount; i++) {
    blocks.push({
      id: `${step.name}-narration-${i}`,
      timestamp,
      loading: false,
      message: {role: 'assistant', content: lines[i]},
    });
  }

  if (done && review) {
    blocks.push({
      id: `${step.name}-result`,
      timestamp: new Date(step.startedAt + STEP_DURATION_MS[step.name]).toISOString(),
      loading: false,
      message: {role: 'assistant', content: CLOSING_LINE[step.name]},
      ...artifactsForStep(step.name, review),
    });
  } else {
    blocks.push({
      id: `${step.name}-thinking`,
      timestamp,
      loading: true,
      message: {
        role: 'assistant',
        content: 'Thinking...',
        thinking_content: null,
      },
    });
  }

  // `metadata.step` is what groups blocks into a section, and only the first
  // block of a section needs to carry it.
  blocks[0]!.message.metadata = {step: step.name, referrer: 'issue_details'};

  return blocks;
}

function artifactsForStep(step: StepName, review: CannedReview): Record<string, any> {
  if (step === 'root_cause') {
    return {
      artifacts: [
        {
          key: 'root_cause',
          reason: 'Read the full game score, the clock trace, and the opening book.',
          data: review.rootCause,
        },
      ],
    };
  }

  if (step === 'solution') {
    return {
      artifacts: [
        {
          key: 'solution',
          reason: 'Derived from the losing moment and the surrounding pattern.',
          data: review.solution,
        },
      ],
    };
  }

  const patch = {
    added: review.patch.added,
    removed: review.patch.removed,
    path: review.patch.path,
    source_file: review.patch.path,
    target_file: review.patch.path,
    type: 'M',
    hunks: review.patch.hunks,
  };

  const filePatch = {
    repo_name: REPO_NAME,
    diff: `--- a/${review.patch.path}\n+++ b/${review.patch.path}`,
    patch,
  };

  return {file_patches: [filePatch], merged_file_patches: [filePatch]};
}

function buildPrStates(run: RunState, now: number): Record<string, any> | undefined {
  if (run.prCreatedAt === null) {
    return undefined;
  }

  const review = run.review ?? REVIEWS[run.cannedIndex]!;
  const creating = now - run.prCreatedAt < PR_DURATION_MS;

  return {
    [REPO_NAME]: {
      repo_name: REPO_NAME,
      branch_name: creating ? null : 'seer/repertoire-fix',
      commit_sha: creating ? null : 'a4v2eg9',
      pr_creation_error: null,
      pr_creation_status: creating ? 'creating' : 'completed',
      pr_id: creating ? null : 812,
      pr_number: creating ? null : 812,
      pr_url: creating ? null : 'https://github.com/pawn-patrol/repertoire/pull/812',
      title: creating ? null : review.patch.title,
    },
  };
}

function buildRunState(run: RunState, now: number): any {
  ensureReview(run);

  const blocks: any[] = [];
  for (const step of run.steps) {
    blocks.push(...buildStepBlocks(run, step, now));
  }

  const anyProcessing = blocks.some(block => block.loading);
  const prStates = buildPrStates(run, now);
  const prCreating = Object.values(prStates ?? {}).some(
    (state: any) => state.pr_creation_status === 'creating'
  );

  return {
    run_id: run.runId,
    sentry_run_id: null,
    blocks,
    status: anyProcessing || prCreating ? 'processing' : 'completed',
    updated_at: new Date(now).toISOString(),
    repo_pr_states: prStates,
    coding_agents: {},
    queued_feedback: [],
    warnings: [],
    pending_user_input: null,
  };
}

/**
 * The registry matches against the API path *with the query string still on it*
 * (the autofix poll sends `?mode=explorer&llmFormat=markdown`), so every pattern
 * has to allow a trailing `?...`. Without that the anchored `$` never matches.
 */
const QS = '(?:\\?.*)?$';

const ISSUE_AUTOFIX = new RegExp(`^/organizations/[^/]+/issues/([^/]+)/autofix/${QS}`);
const ISSUE_AUTOFIX_SETUP = new RegExp(
  `^/organizations/[^/]+/issues/([^/]+)/autofix/setup/${QS}`
);
const ISSUE_AUTOFIX_REPOS = new RegExp(
  `^/organizations/[^/]+/issues/([^/]+)/autofix/repos/${QS}`
);
const ORG_SEER = (suffix: string) => new RegExp(`^/organizations/[^/]+/${suffix}/${QS}`);

function issueIdFrom(url: string, pattern: RegExp): string {
  return pattern.exec(url)?.[1] ?? 'unknown';
}

function startStep(run: RunState, name: StepName, userContext?: string) {
  const existing = run.steps.findIndex(step => step.name === name);
  if (existing >= 0) {
    // Re-running a step discards it and everything after it, which is what the
    // "rethink this" flow in the drawer expects.
    run.steps.length = existing;
  }
  run.steps.push({name, startedAt: Date.now(), userContext});
  run.prCreatedAt = null;
}

const routes: ChessRoute[] = [
  // `/autofix/setup/` and `/autofix/repos/` are prefixed by `/autofix/`, so they
  // have to be registered before it — first match wins.
  {
    url: ISSUE_AUTOFIX_SETUP,
    handler: () => ({
      billing: {hasAutofixQuota: true},
      integration: {ok: true, reason: null},
      seerReposLinked: true,
    }),
  },
  {
    url: ISSUE_AUTOFIX_REPOS,
    handler: () => ({
      repos: [
        {
          default_branch: 'main',
          external_id: '1',
          has_read_access: true,
          has_write_access: true,
          integration_id: 1,
          name: 'repertoire',
          owner: 'pawn-patrol',
          provider: 'github',
          repo_name: REPO_NAME,
        },
      ],
    }),
  },
  {
    // GET returns the run (creating one on first look so the drawer is never
    // empty); POST starts or restarts a step.
    url: ISSUE_AUTOFIX,
    handler: (url, options) => {
      const issueId = issueIdFrom(url, ISSUE_AUTOFIX);
      const method = (options?.method ?? 'GET').toUpperCase();

      if (method === 'POST') {
        const data = options?.data ?? {};
        const run = getRun(issueId) ?? createRun(issueId);
        const step = data.step as string | undefined;

        if (step === 'open_pr') {
          run.prCreatedAt = Date.now();
          return {run_id: run.runId};
        }

        if (step === 'coding_agent_handoff') {
          return {successes: [], failures: []};
        }

        if (step === 'root_cause' || step === 'solution' || step === 'code_changes') {
          startStep(run, step, data.user_context);
        }

        return {run_id: run.runId};
      }

      // GET. Auto-start the review the first time anyone looks at the game, so
      // the drawer always has something to show.
      let run = getRun(issueId);
      if (!run) {
        run = createRun(issueId);
        startStep(run, 'root_cause');
      }

      return {autofix: buildRunState(run, Date.now())};
    },
  },
  {
    // Project-level Seer repo config (settings + the drawer's setup checks).
    url: new RegExp(`^/projects/[^/]+/[^/]+/seer/repos/${QS}`),
    handler: () => [
      {
        id: '1',
        repositoryId: '1',
        organizationId: '1',
        name: 'repertoire',
        owner: 'pawn-patrol',
        provider: 'github',
        externalId: '1',
        integrationId: '1',
        branchName: 'main',
        branchOverrides: [],
        instructions: '',
      },
    ],
  },
  {
    url: ORG_SEER('seer/setup-check'),
    handler: () => ({
      billing: {hasAutofixQuota: true, hasScannerQuota: true},
      hasFreeAutofixAccess: true,
    }),
  },
  {
    url: ORG_SEER('seer/onboarding-check'),
    handler: () => ({
      hasSupportedScmIntegration: true,
      isAutofixEnabled: true,
      isCodeReviewEnabled: false,
      isSeerConfigured: true,
    }),
  },
  {
    url: ORG_SEER('integrations/coding-agents'),
    handler: () => ({integrations: []}),
  },
  {
    url: ORG_SEER('seer/runs'),
    handler: () => [],
  },
  {
    url: ORG_SEER('seer/projects'),
    handler: () => [],
  },
  {
    url: ORG_SEER('seer/preferences'),
    handler: () => ({}),
  },
  {
    // Acknowledgement / consent writes from the Seer surfaces. Always fine.
    url: ORG_SEER('seer/acknowledge'),
    handler: () => ({}),
  },
];

// The chessMode registry loads domains via require.context and reads their
// default export, so this file has to have one.
// eslint-disable-next-line @sentry/no-default-exports
export default routes;
