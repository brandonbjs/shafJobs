/**
 * client/tailwind.config.js — Tailwind CSS Configuration
 *
 * The `content` array tells Tailwind which files to scan for class names.
 * Classes not found in these files will be purged from the production build,
 * keeping the CSS bundle tiny.
 *
 * We extend the theme with a few custom colors that match the ShafJobs
 * badge system (industry colors, confidence colors).
 */

/** @type {import('tailwindcss').Config} */
export default {
  // Only include files that actually use Tailwind classes
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],

  theme: {
    extend: {
      colors: {
        // App-level brand colors
        brand: {
          primary: '#2563eb',   // blue-600
          secondary: '#7c3aed', // violet-600
          accent: '#059669',    // emerald-600
        },
      },

      // Custom animation for the skeleton loading cards
      animation: {
        shimmer: 'shimmer 1.5s infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },

  plugins: [],
};
