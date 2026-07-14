import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PhotoSwipeDeck } from '../components/PhotoSwipeDeck.tsx';
import { QuizFramework, type QuizChoiceQuestion } from '../components/QuizFramework.tsx';
import { DragRankList } from '../components/DragRankList.tsx';
import { AntiPreferenceControl } from '../components/AntiPreferenceControl.tsx';
import { HardExclusionControl } from '../components/HardExclusionControl.tsx';
import { BecauseYouSaidChips } from '../components/BecauseYouSaidChips.tsx';
import { DefiningSightOverride } from '../components/DefiningSightOverride.tsx';
import { TravelerProfileEditor } from '../components/TravelerProfileEditor.tsx';
import { TasteProfileEditor } from '../components/TasteProfileEditor.tsx';
import { OnboardingRoute } from '../screens/OnboardingFlow.tsx';
import type { TasteRanking, DefiningSight } from '../logic/override.ts';
import { SessionProvider, createMemoryNavigator, createMockAuthApi } from '../../auth/index.ts';

const render = (node: ReactElement): string => renderToStaticMarkup(node);

const QUESTIONS: QuizChoiceQuestion[] = [
  { id: 'age_band', prompt: 'Which age band fits you?', options: [{ value: '26-44', label: '26–44' }] },
];

describe('onboarding components render (AC #2–#7)', () => {
  it('PhotoSwipeDeck shows a choice-based card with Pass/Into it/Love it (AC #6)', () => {
    const html = render(<PhotoSwipeDeck onComplete={() => {}} />);
    expect(html).toContain('Into this?');
    expect(html).toContain('Pass');
    expect(html).toContain('Into it');
    expect(html).toContain('Love it');
  });

  it('QuizFramework shows an endowed progress label + one question (AC #4)', () => {
    const html = render(
      <QuizFramework
        endowed={{ label: 'Account created', reason: 'You already created your account.' }}
        questions={QUESTIONS}
        onComplete={() => {}}
      />,
    );
    expect(html).toContain('Account created ✓ — 1 of 2');
    expect(html).toContain('Which age band fits you?');
    expect(html).toContain('role="progressbar"');
  });

  it('DragRankList renders ranked rows with reorder controls (AC #2)', () => {
    const html = render(
      <DragRankList values={['architecture', 'coffee']} onChange={() => {}} label="Ranked interests" />,
    );
    expect(html).toContain('Architecture');
    expect(html).toContain('Coffee');
    expect(html).toContain('Move Architecture down');
  });

  it('AntiPreferenceControl reads as SOFT down-weight (AC #2)', () => {
    const html = render(<AntiPreferenceControl values={['crowded_nightlife']} onChange={() => {}} />);
    expect(html).toContain('Less of this');
    expect(html).toContain('fewer of these');
  });

  it('HardExclusionControl is a distinct "Never show me" absolute control (AC #2)', () => {
    const html = render(<HardExclusionControl values={['casinos']} onChange={() => {}} />);
    expect(html).toContain('Never show me');
    expect(html).toContain('absolute rule');
    expect(html).toContain('type="checkbox"');
  });

  it('BecauseYouSaidChips renders because-you-said chips for stored answers (AC #5)', () => {
    const html = render(
      <BecauseYouSaidChips
        taste={{ interests: ['coffee'], dietary: ['vegetarian'], pace: 'moderate', budget_tier: 'comfort' }}
      />,
    );
    expect(html).toContain('Because you said: Coffee');
    expect(html).toContain('Because you said: Vegetarian');
  });

  it('DefiningSightOverride shows the shown-despite-low-interest banner (AC #3)', () => {
    const taste: TasteRanking = { interests: ['coffee'], anti_preferences: [], hard_exclusions: [] };
    const sight: DefiningSight = {
      id: 'louvre',
      title: 'The Louvre',
      interestTag: 'museums',
      reason: "it's the defining collection",
    };
    const html = render(<DefiningSightOverride taste={taste} sight={sight} onRemove={() => {}} />);
    expect(html).toContain('The Louvre');
    expect(html).toContain('Shown despite low interest');
    expect(html).toContain('Remove');
  });

  it('DefiningSightOverride renders nothing when hard-excluded (absolute veto)', () => {
    const taste: TasteRanking = { interests: ['coffee'], anti_preferences: [], hard_exclusions: ['museums'] };
    const sight: DefiningSight = { id: 'l', title: 'The Louvre', interestTag: 'museums', reason: 'x' };
    expect(render(<DefiningSightOverride taste={taste} sight={sight} onRemove={() => {}} />)).toBe('');
  });

  it('TravelerProfileEditor shows age bands framed as non-limiting (AC #7)', () => {
    const html = render(<TravelerProfileEditor value={null} onSave={() => {}} />);
    expect(html).toContain('Age band');
    expect(html).toContain('never to limit');
    expect(html).toContain('Save traveler profile');
  });

  it('TasteProfileEditor surfaces the editable pace preset for an age band (AC #7)', () => {
    const html = render(
      <TasteProfileEditor value={null} initialInterests={['coffee']} ageBand="65+" onSave={() => {}} />,
    );
    expect(html).toContain('Suggested pace for 65+');
    expect(html).toContain('starting point');
    // low-interest defining sight override is live in the editor:
    expect(html).toContain('Shown despite low interest');
  });
});

describe('onboarding route (AC #1)', () => {
  it('OnboardingRoute mounts the flow intro', () => {
    const html = render(
      <SessionProvider
        api={createMockAuthApi()}
        navigator={createMemoryNavigator('/onboarding')}
        autoRefresh={false}
      >
        <OnboardingRoute />
      </SessionProvider>,
    );
    expect(html).toContain('tune InTown to you');
  });
});
