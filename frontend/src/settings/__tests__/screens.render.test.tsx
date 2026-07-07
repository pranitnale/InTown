import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SettingsRoute } from '../screens/SettingsScreen.tsx';
import { GdprControls } from '../components/GdprControls.tsx';
import { ProfileProvider } from '../../onboarding/index.ts';
import { createMockProfileApi } from '../../onboarding/index.ts';

const render = (node: ReactElement): string => renderToStaticMarkup(node);

describe('settings screen (AC #1)', () => {
  it('SettingsRoute renders the settings chrome', () => {
    const html = render(<SettingsRoute />);
    expect(html).toContain('Settings');
    expect(html).toContain('control over your data');
  });

  it('GdprControls presents export + delete (AC #1)', () => {
    const html = render(
      <ProfileProvider api={createMockProfileApi()} autoLoad={false}>
        <GdprControls />
      </ProfileProvider>,
    );
    expect(html).toContain('Export my data');
    expect(html).toContain('Delete my account');
  });
});
