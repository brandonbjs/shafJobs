/**
 * client/src/components/FilterSidebar.jsx — Filter Controls Panel
 *
 * Left-side panel containing all filter controls:
 *  - Keyword search (delegates to SearchBar)
 *  - Location type checkboxes (Remote, Hybrid, On-Site)
 *  - Industry checkboxes (5 sectors)
 *  - Salary slider ($0–$200K) + "Show unlisted" toggle
 *  - Date posted (radio: any / 24h / week / month)
 *  - Match score minimum slider (0–100%)
 *  - Entry-level confidence checkboxes
 *  - Reset all filters button
 *
 * Props:
 *  - filters: Object — current filter state from useJobs
 *  - updateFilter: function(key, value) — update a single filter
 *  - toggleArrayFilter: function(key, value) — toggle value in array filter
 *  - resetFilters: function() — reset to defaults
 *  - resultCount: number — shown at top of sidebar
 */

import React from 'react';
import SearchBar from './SearchBar';

const LOCATION_OPTIONS = [
  { value: 'remote', label: 'Remote', icon: '🌐' },
  { value: 'hybrid', label: 'Hybrid Phoenix', icon: '🏢' },
  { value: 'onsite', label: 'On-Site', icon: '📍' },
];

const INDUSTRY_OPTIONS = [
  { value: 'tech', label: 'General Tech', icon: '💻' },
  { value: 'healthcare', label: 'Healthcare IT', icon: '🏥' },
  { value: 'finance', label: 'Financial', icon: '💰' },
  { value: 'gov-defense', label: 'Gov / Defense', icon: '🏛️' },
  { value: 'saas', label: 'SaaS Startups', icon: '☁️' },
];

const CONFIDENCE_OPTIONS = [
  { value: 'confirmed', label: 'Confirmed Entry Level' },
  { value: 'likely', label: 'Likely Entry Level' },
  { value: 'unconfirmed', label: 'Unconfirmed' },
];

const DATE_OPTIONS = [
  { value: 'any', label: 'Any time' },
  { value: 'day', label: 'Last 24 hours' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
];

const SORT_OPTIONS = [
  { value: 'match', label: 'Best Match' },
  { value: 'date', label: 'Newest First' },
  { value: 'salary', label: 'Highest Salary' },
];

/**
 * A reusable section header for the filter groups.
 */
function SectionHeader({ children }) {
  return (
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
      {children}
    </h3>
  );
}

/**
 * A styled checkbox with a label.
 */
function Checkbox({ checked, onChange, label, icon }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:text-white transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-blue-500
                   focus:ring-blue-500 focus:ring-offset-gray-900 cursor-pointer"
      />
      {icon && <span className="text-base leading-none">{icon}</span>}
      <span>{label}</span>
    </label>
  );
}

export default function FilterSidebar({
  filters,
  updateFilter,
  toggleArrayFilter,
  resetFilters,
  resultCount,
}) {
  return (
    <aside className="w-72 flex-shrink-0 bg-gray-900 border-r border-gray-800 h-[calc(100vh-3.5rem)]
                      sticky top-14 overflow-y-auto p-5 flex flex-col gap-6">

      {/* Result count + reset */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">
          <span className="text-white font-semibold">{resultCount.toLocaleString()}</span> listings
        </span>
        <button
          onClick={resetFilters}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          Reset filters
        </button>
      </div>

      {/* Keyword search */}
      <div>
        <SectionHeader>Search</SectionHeader>
        <SearchBar
          value={filters.search}
          onChange={(val) => updateFilter('search', val)}
        />
      </div>

      {/* Sort */}
      <div>
        <SectionHeader>Sort By</SectionHeader>
        <select
          value={filters.sort}
          onChange={(e) => updateFilter('sort', e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm
                     text-gray-200 focus:outline-none focus:border-blue-500"
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Location type */}
      <div>
        <SectionHeader>Location</SectionHeader>
        <div className="flex flex-col gap-2">
          {LOCATION_OPTIONS.map(opt => (
            <Checkbox
              key={opt.value}
              checked={filters.location_type.includes(opt.value)}
              onChange={() => toggleArrayFilter('location_type', opt.value)}
              label={opt.label}
              icon={opt.icon}
            />
          ))}
        </div>
      </div>

      {/* Industry */}
      <div>
        <SectionHeader>Industry</SectionHeader>
        <div className="flex flex-col gap-2">
          {INDUSTRY_OPTIONS.map(opt => (
            <Checkbox
              key={opt.value}
              checked={filters.industry.length === 0 || filters.industry.includes(opt.value)}
              onChange={() => toggleArrayFilter('industry', opt.value)}
              label={opt.label}
              icon={opt.icon}
            />
          ))}
          {filters.industry.length > 0 && (
            <button
              onClick={() => updateFilter('industry', [])}
              className="text-xs text-blue-400 hover:text-blue-300 text-left transition-colors mt-1"
            >
              Show all industries
            </button>
          )}
        </div>
      </div>

      {/* Salary */}
      <div>
        <SectionHeader>Minimum Salary</SectionHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">$0</span>
            <span className="text-white font-medium">
              {filters.salary_min === 0 ? 'Any' : `$${(filters.salary_min / 1000).toFixed(0)}K`}
            </span>
            <span className="text-gray-400">$200K</span>
          </div>
          <input
            type="range"
            min={0}
            max={200000}
            step={5000}
            value={filters.salary_min}
            onChange={(e) => updateFilter('salary_min', Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.show_unlisted_salary}
              onChange={(e) => updateFilter('show_unlisted_salary', e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-blue-500 cursor-pointer"
            />
            <span>Include unlisted salary</span>
          </label>
        </div>
      </div>

      {/* Date posted */}
      <div>
        <SectionHeader>Date Posted</SectionHeader>
        <div className="flex flex-col gap-2">
          {DATE_OPTIONS.map(opt => (
            <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:text-white transition-colors">
              <input
                type="radio"
                name="date_range"
                value={opt.value}
                checked={filters.date_range === opt.value}
                onChange={() => updateFilter('date_range', opt.value)}
                className="w-3.5 h-3.5 border-gray-600 bg-gray-800 text-blue-500 cursor-pointer"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Min match score */}
      <div>
        <SectionHeader>Minimum Match Score</SectionHeader>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">0%</span>
            <span className="text-white font-medium">{filters.min_match}%</span>
            <span className="text-gray-400">100%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={filters.min_match}
            onChange={(e) => updateFilter('min_match', Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Entry-level confidence */}
      <div>
        <SectionHeader>Entry-Level Confidence</SectionHeader>
        <div className="flex flex-col gap-2">
          {CONFIDENCE_OPTIONS.map(opt => (
            <Checkbox
              key={opt.value}
              checked={filters.confidence.includes(opt.value)}
              onChange={() => toggleArrayFilter('confidence', opt.value)}
              label={opt.label}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
