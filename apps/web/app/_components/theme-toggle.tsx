'use client';

import { useEffect, useState } from 'react';

type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'formatedit-theme-preference';

function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  root.dataset.theme = mode;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>('system');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      setTheme(stored);
      applyTheme(stored);
      return;
    }

    applyTheme('system');
  }, []);

  function updateTheme(nextTheme: ThemeMode): void {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  }

  return (
    <fieldset className="theme-toggle" aria-label="Theme preference">
      <legend>Theme</legend>
      {(['system', 'light', 'dark'] as const).map((option) => (
        <button
          key={option}
          type="button"
          className={theme === option ? 'is-active' : undefined}
          aria-pressed={theme === option}
          onClick={() => updateTheme(option)}
        >
          {option === 'system'
            ? 'System'
            : option === 'light'
              ? 'Light'
              : 'Dark'}
        </button>
      ))}
    </fieldset>
  );
}
