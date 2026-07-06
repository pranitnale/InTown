import { useCallback, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn, FOCUS_RING } from './utils.ts';

export interface TabItem {
  id: string;
  label: ReactNode;
  content?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  /** Controlled selected tab id. */
  value?: string;
  /** Uncontrolled initial selection (defaults to the first tab). */
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  className?: string;
}

/**
 * Horizontal tabs with CSS scroll-snap overflow and a roving-tabindex keyboard
 * model (Arrow keys move focus + selection, Home/End jump to ends, disabled
 * tabs are skipped). Selected tab shows an underline indicator.
 */
export function Tabs({ tabs, value, defaultValue, onValueChange, className }: TabsProps) {
  const baseId = useId();
  const firstEnabled = tabs.find((t) => !t.disabled)?.id;
  const [internal, setInternal] = useState(defaultValue ?? firstEnabled ?? tabs[0]?.id);
  const selected = value ?? internal;
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const select = useCallback(
    (id: string) => {
      if (value === undefined) setInternal(id);
      onValueChange?.(id);
    },
    [value, onValueChange],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const enabled = tabs.filter((t) => !t.disabled);
      const currentIndex = enabled.findIndex((t) => t.id === selected);
      if (currentIndex === -1) return;
      let nextIndex: number | null = null;
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          nextIndex = (currentIndex + 1) % enabled.length;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          nextIndex = (currentIndex - 1 + enabled.length) % enabled.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = enabled.length - 1;
          break;
        default:
          return;
      }
      event.preventDefault();
      const next = enabled[nextIndex];
      if (!next) return;
      select(next.id);
      tabRefs.current.get(next.id)?.focus();
    },
    [tabs, selected, select],
  );

  const activeTab = tabs.find((t) => t.id === selected);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="flex snap-x snap-mandatory gap-1 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const isSelected = tab.id === selected;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
                else tabRefs.current.delete(tab.id);
              }}
              role="tab"
              type="button"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={isSelected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => select(tab.id)}
              onKeyDown={onKeyDown}
              className={cn(
                'snap-start whitespace-nowrap border-b-2 px-4 py-2 text-base font-medium -mb-px',
                'transition-colors motion-reduce:transition-none',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                isSelected
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text',
                FOCUS_RING,
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {activeTab ? (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${activeTab.id}`}
          aria-labelledby={`${baseId}-tab-${activeTab.id}`}
          tabIndex={0}
          className={cn('text-text', FOCUS_RING)}
        >
          {activeTab.content}
        </div>
      ) : null}
    </div>
  );
}
