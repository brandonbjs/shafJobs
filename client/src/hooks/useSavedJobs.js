/**
 * client/src/hooks/useSavedJobs.js — Saved/Bookmarked Jobs State
 *
 * Manages all client-side state for Brandon's saved job listings:
 *  - Fetching the saved list
 *  - Saving a new job (by jobId)
 *  - Updating notes on a saved job
 *  - Removing a saved job
 *  - Exporting the saved list as a CSV file
 *
 * Brandon: the savedJobIds Set is used by the Dashboard to show a
 * filled bookmark icon on cards that are already saved.
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

/**
 * @returns {Object} saved job state and operations
 */
export function useSavedJobs() {
  const [savedJobs, setSavedJobs] = useState([]);
  const [savedJobIds, setSavedJobIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Fetch saved jobs ───────────────────────────────────────────────────────

  const fetchSaved = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/saved');
      const data = response.data;
      setSavedJobs(data);

      // Build a Set of jobId strings for quick O(1) "is this saved?" checks
      const ids = new Set(data.map(s => s.jobId?._id?.toString()).filter(Boolean));
      setSavedJobIds(ids);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load saved jobs');
      console.error('[useSavedJobs] Fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Save a job ─────────────────────────────────────────────────────────────

  /**
   * Bookmarks a job by its MongoDB _id.
   * @param {string} jobId — the Job document's _id
   * @param {string} notes — optional initial note
   */
  const saveJob = useCallback(async (jobId, notes = '') => {
    try {
      const response = await axios.post('/api/saved', { jobId, notes });
      const newSaved = response.data;

      setSavedJobs(prev => [newSaved, ...prev]);
      setSavedJobIds(prev => new Set([...prev, jobId]));
    } catch (err) {
      if (err.response?.status === 409) {
        console.log('[useSavedJobs] Already saved');
        return; // Not an error from the user's perspective
      }
      console.error('[useSavedJobs] Save error:', err.message);
      throw err;
    }
  }, []);

  // ── Unsave a job ───────────────────────────────────────────────────────────

  /**
   * Removes a bookmark by the SavedJob document's _id.
   * @param {string} savedId — the SavedJob document's _id (not the Job id)
   */
  const unsaveJob = useCallback(async (savedId) => {
    try {
      await axios.delete(`/api/saved/${savedId}`);

      setSavedJobs(prev => {
        const removed = prev.find(s => s._id === savedId);
        const next = prev.filter(s => s._id !== savedId);

        // Also update the savedJobIds Set
        if (removed?.jobId?._id) {
          setSavedJobIds(prevIds => {
            const newIds = new Set(prevIds);
            newIds.delete(removed.jobId._id.toString());
            return newIds;
          });
        }

        return next;
      });
    } catch (err) {
      console.error('[useSavedJobs] Unsave error:', err.message);
      throw err;
    }
  }, []);

  // ── Update notes on a saved job ────────────────────────────────────────────

  /**
   * Updates the notes on a saved job.
   * @param {string} savedId — the SavedJob document's _id
   * @param {string} notes — new notes text
   */
  const updateNotes = useCallback(async (savedId, notes) => {
    try {
      const response = await axios.patch(`/api/saved/${savedId}`, { notes });

      setSavedJobs(prev =>
        prev.map(s => s._id === savedId ? { ...s, notes: response.data.notes } : s)
      );
    } catch (err) {
      console.error('[useSavedJobs] Update notes error:', err.message);
      throw err;
    }
  }, []);

  // ── Export to CSV ──────────────────────────────────────────────────────────

  /**
   * Exports the saved jobs list as a CSV file download.
   * Columns: Title, Company, Location, Salary Min, Source URL, Notes, Saved Date
   */
  const exportCsv = useCallback(() => {
    if (savedJobs.length === 0) return;

    const headers = ['Title', 'Company', 'Location', 'Salary Min', 'Source URL', 'Notes', 'Saved Date'];

    const rows = savedJobs.map(s => {
      const job = s.jobId;
      if (!job) return null;

      const salary = job.salaryMin ? `$${job.salaryMin.toLocaleString()}` : 'Not listed';
      const date = s.savedAt ? new Date(s.savedAt).toLocaleDateString() : '';

      // Escape CSV fields that contain commas or quotes
      const escape = (str) => `"${(str || '').replace(/"/g, '""')}"`;

      return [
        escape(job.title),
        escape(job.company),
        escape(job.location),
        escape(salary),
        escape(job.url),
        escape(s.notes),
        escape(date),
      ].join(',');
    }).filter(Boolean);

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `shafjobs-saved-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [savedJobs]);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  return {
    savedJobs,
    savedJobIds,
    loading,
    error,
    saveJob,
    unsaveJob,
    updateNotes,
    exportCsv,
    refetch: fetchSaved,
  };
}
