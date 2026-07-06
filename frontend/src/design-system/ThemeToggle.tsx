import { useAppStore } from '../store/app.ts';
import type { ThemePreference } from '../store/app.ts';

/**
 * Minimal accessible theme control (radio group) for the theme preference
 * (System / Light / Dark). The full settings UI lands in a later phase; this
 * exists so the system-default + in-app override (AC #8) is exercisable now.
 */
const OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function ThemeToggle() {
  const preference = useAppStore((s) => s.themePreference);
  const setPreference = useAppStore((s) => s.setThemePreference);

  return (
    <fieldset
      className="theme-toggle"
      role="radiogroup"
      aria-label="Theme"
      style={{ display: 'inline-flex', gap: '0.5rem', border: 0, padding: 0, margin: 0 }}
    >
      {OPTIONS.map((option) => (
        <label key={option.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <input
            type="radio"
            name="theme-preference"
            value={option.value}
            checked={preference === option.value}
            onChange={() => setPreference(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
