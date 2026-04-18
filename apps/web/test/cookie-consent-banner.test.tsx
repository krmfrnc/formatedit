import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { CookieConsentBanner } from '../app/_components/cookie-consent-banner';

describe('CookieConsentBanner', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
      configurable: true,
    });
  });

  it('renders until a consent choice is stored', async () => {
    render(<CookieConsentBanner />);
    expect(await screen.findByLabelText(/cookie consent banner/i)).toBeInTheDocument();
  });

  it('persists essential-only consent and hides itself', async () => {
    render(<CookieConsentBanner />);
    fireEvent.click(await screen.findByRole('button', { name: /sadece zorunlu/i }));

    expect(window.localStorage.getItem('formatedit-cookie-consent')).toBe('essential-only');
    expect(screen.queryByLabelText(/cookie consent banner/i)).not.toBeInTheDocument();
  });

  it('persists full consent and hides itself', async () => {
    render(<CookieConsentBanner />);
    fireEvent.click(await screen.findByRole('button', { name: /tumunu kabul et/i }));

    expect(window.localStorage.getItem('formatedit-cookie-consent')).toBe('accepted');
    expect(screen.queryByLabelText(/cookie consent banner/i)).not.toBeInTheDocument();
  });
});
