import type { Preview } from '@storybook/react';
import '../app/globals.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#f8fafc' },
        { name: 'dark', value: '#0b0f19' },
      ],
    },
    a11y: { element: '#storybook-root', config: {}, options: {} },
  },
};

export default preview;
