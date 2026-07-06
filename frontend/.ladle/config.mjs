/** @type {import('@ladle/react').UserConfig} */
export default {
  stories: 'src/**/*.stories.{ts,tsx}',
  addons: {
    // Our Provider renders each story in both light and dark panels, so the
    // built-in single-axis theme switch would be redundant/misleading.
    theme: { enabled: false },
    mode: { enabled: true },
    rtl: { enabled: false },
    source: { enabled: true },
  },
};
