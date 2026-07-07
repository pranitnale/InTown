/**
 * Progressive-profiling quiz framework (AC #4, §6.2 friction law).
 *
 * Rules encoded here (pure, DOM-free, reusable by P07's trip-scoped flow):
 *  - ONE question per screen (`cursor` indexes a single active question).
 *  - A progress bar whose FIRST step is genuinely earned and pre-completed,
 *    with a stated real reason — never a fake head-start. The framework REQUIRES
 *    a non-empty {@link EndowedStep.reason}; an empty reason throws, so a fake
 *    head-start cannot be configured.
 *  - Friction law: a question should only be included when its answer visibly
 *    changes output. The framework does not invent questions — the caller passes
 *    exactly the questions that matter.
 */

/** The pre-completed, genuinely-earned first step (endowed progress). */
export interface EndowedStep {
  /** Short label, e.g. "City selected" or "Account created". */
  label: string;
  /** The REAL reason this step is already done (why it was genuinely earned). */
  reason: string;
}

export interface QuizQuestion {
  id: string;
  /** The single prompt shown on this question's screen. */
  prompt: string;
  /** Why answering this changes the output (friction-law justification). */
  rationale?: string;
}

export interface QuizConfig {
  endowed: EndowedStep;
  questions: readonly QuizQuestion[];
}

export interface QuizState {
  /** Answers keyed by question id. */
  answers: Readonly<Record<string, string>>;
  /** 0-based index into `questions` of the active (on-screen) question. */
  cursor: number;
  /** True once the user advances past the last question. */
  done: boolean;
}

export interface QuizProgress {
  /** Completed steps INCLUDING the earned endowed step. */
  completed: number;
  /** Total steps = 1 (endowed) + questions. */
  total: number;
  /** 1-based number of the step currently on screen (endowed is step 1). */
  currentStep: number;
  /** e.g. "City selected ✓ — 1 of 6". */
  label: string;
}

/** Validate config and produce the initial state (cursor at first question). */
export function initQuiz(config: QuizConfig): QuizState {
  if (config.endowed.reason.trim().length === 0) {
    throw new Error(
      'Endowed progress must state a real reason — a fake head-start is not allowed.',
    );
  }
  return { answers: {}, cursor: 0, done: config.questions.length === 0 };
}

/** The question currently on screen, or null when the quiz is done. */
export function currentQuestion(config: QuizConfig, state: QuizState): QuizQuestion | null {
  if (state.done) return null;
  return config.questions[state.cursor] ?? null;
}

/** Record an answer for the active question and advance one step. */
export function answer(
  config: QuizConfig,
  state: QuizState,
  questionId: string,
  value: string,
): QuizState {
  const answers = { ...state.answers, [questionId]: value };
  const nextCursor = state.cursor + 1;
  const done = nextCursor >= config.questions.length;
  return { answers, cursor: done ? config.questions.length - 1 : nextCursor, done };
}

/** Step back to the previous question (clamped at the first). */
export function back(state: QuizState): QuizState {
  if (state.cursor <= 0) return { ...state, cursor: 0, done: false };
  return { ...state, cursor: state.cursor - 1, done: false };
}

/**
 * Progress including the earned endowed step. `completed` counts the endowed
 * step plus every answered question, so the bar starts at 1/total with a real
 * reason and never shows a fabricated lead.
 */
export function progress(config: QuizConfig, state: QuizState): QuizProgress {
  const total = 1 + config.questions.length;
  const answered = Object.keys(state.answers).length;
  const completed = Math.min(total, 1 + answered);
  const currentStep = state.done ? total : Math.min(total, state.cursor + 2);
  return {
    completed,
    total,
    currentStep,
    label: `${config.endowed.label} ✓ — ${completed} of ${total}`,
  };
}
