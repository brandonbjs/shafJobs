/**
 * client/src/components/SkeletonCard.jsx — Loading Placeholder Card
 *
 * Shown in the job grid while the API fetch is in progress.
 * The shimmer animation (defined in index.css) gives a "loading" feel
 * that's much better UX than a spinner.
 *
 * Brandon: skeleton screens are a standard UX pattern. Instead of a blank
 * page with a spinner, the user sees the approximate shape of the content
 * they're about to receive — feels much faster.
 */

import React from 'react';

export default function SkeletonCard() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3">
      {/* Title + company */}
      <div className="space-y-2">
        <div className="h-5 rounded-md skeleton-shimmer w-3/4" />
        <div className="h-4 rounded-md skeleton-shimmer w-1/2" />
      </div>

      {/* Badge row */}
      <div className="flex flex-wrap gap-2">
        <div className="h-5 w-20 rounded-full skeleton-shimmer" />
        <div className="h-5 w-24 rounded-full skeleton-shimmer" />
        <div className="h-5 w-16 rounded-full skeleton-shimmer" />
      </div>

      {/* Description */}
      <div className="space-y-1">
        <div className="h-3 rounded skeleton-shimmer" />
        <div className="h-3 rounded skeleton-shimmer w-5/6" />
        <div className="h-3 rounded skeleton-shimmer w-4/6" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-1">
        <div className="h-4 w-28 rounded skeleton-shimmer" />
        <div className="h-8 w-24 rounded-lg skeleton-shimmer" />
      </div>
    </div>
  );
}
