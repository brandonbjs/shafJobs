/**
 * client/postcss.config.js — PostCSS Configuration
 *
 * PostCSS processes CSS through plugins. Tailwind and Autoprefixer
 * are the standard pair for modern CSS processing:
 *
 * - tailwindcss:   generates utility classes from our config
 * - autoprefixer:  adds vendor prefixes (-webkit-, etc.) for browser compatibility
 */

export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
