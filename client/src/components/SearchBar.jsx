/**
 * client/src/components/SearchBar.jsx — Keyword Search Input
 *
 * A debounced search input that filters jobs by title, company, or description.
 * Debouncing means we wait 350ms after the user stops typing before firing
 * the API call — this prevents a request on every single keypress.
 *
 * Props:
 *  - value: string — current search value (controlled)
 *  - onChange: function — called with the new search string
 */

import React, { useState, useEffect } from 'react';

export default function SearchBar({ value, onChange }) {
  // Local state for the raw input — we debounce before calling onChange
  const [localValue, setLocalValue] = useState(value);

  // Sync localValue when parent resets filters
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounce: wait 350ms after last keystroke before calling parent onChange
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [localValue]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative">
      {/* Search icon */}
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder="Search title, company, or description..."
        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-9 py-2.5
                   text-sm text-gray-100 placeholder-gray-500
                   focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                   transition-colors"
      />

      {/* Clear button */}
      {localValue && (
        <button
          onClick={() => { setLocalValue(''); onChange(''); }}
          className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-300"
          aria-label="Clear search"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
