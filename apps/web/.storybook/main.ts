import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  stories: [
    '../app/**/*.stories.@(ts|tsx|mdx)',
    '../app/_components/**/*.stories.@(ts|tsx|mdx)',
  ],
  addons: ['@storybook/addon-a11y'],
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },
  docs: { autodocs: 'tag' },
};

export default config;
