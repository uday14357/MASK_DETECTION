import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Download,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  RefreshCw,
  Check
} from 'lucide-react';
import { api } from '../services/api';

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ackFilter, setAckFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Detail Modal
  const [selectedEvent, setSelectedEvent] = useState(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 15,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        acknowledged: ackFilter === 'acknowledged' ? true : ackFilter === 'unacknowledged' ? false : undefined,
        search: search.trim() || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      };

      const res = await api.getEvents(params);
      setEvents(res.events || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [page, statusFilter, ackFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchEvents();
  };

  const handleAcknowledge = async (eventId) => {
    try {
      await api.acknowledgeEvent(eventId);
      if (selectedEvent && selectedEvent._id === eventId) {
        setSelectedEvent({ ...selectedEvent, acknowledged: true });
      }
      fetchEvents();
    } catch (err) {
      alert(`Acknowledgement error: ${err.message}`);
    }
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params = {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      };
      const blob = await api.exportEventsCsv(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `maskguard_events_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Alerts & Event History</h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete audit trail of detected non-compliance incidents and resolved warnings.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>{exporting ? 'Generating CSV...' : 'Export to CSV'}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by camera name, request ID, or severity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700"
            >
              <option value="all">All Classifications</option>
              <option value="no_mask">No Mask (Alerts)</option>
              <option value="mask">Mask Detected</option>
            </select>

            <select
              value={ackFilter}
              onChange={(e) => { setAckFilter(e.target.value); setPage(1); }}
              className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700"
            >
              <option value="all">All Statuses</option>
              <option value="unacknowledged">Unacknowledged Only</option>
              <option value="acknowledged">Acknowledged Only</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold cursor-pointer"
            >
              Apply Filter
            </button>
          </div>
        </form>
      </div>

      {/* Events Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Local Timestamp</th>
                <th className="py-3 px-4">Source / Camera</th>
                <th className="py-3 px-4">Status & Counts</th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Acknowledged</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((ev) => (
                <tr key={ev._id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-800">
                    <div>{new Date(ev.processed_at).toLocaleDateString()}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {new Date(ev.processed_at).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-700 font-semibold">
                    {ev.camera_name || 'Webcam'}
                  </td>
                  <td className="py-3 px-4">
                    {ev.labels_summary?.no_mask > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold text-[10px]">
                        No Mask ({ev.labels_summary.no_mask})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        Mask ({ev.labels_summary?.mask || 0})
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {(ev.confidence_summary * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        ev.severity === 'critical'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {ev.severity}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {ev.acknowledged ? (
                      <span className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                        <Check className="w-3.5 h-3.5" />
                        Ack'd
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[10px]">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    {!ev.acknowledged && (
                      <button
                        onClick={() => handleAcknowledge(ev._id)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        Ack
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedEvent(ev)}
                      className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title="Inspect event details"
                    >
                      <Eye className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {events.length === 0 && !loading && (
          <div className="p-12 text-center text-xs text-slate-400">
            No events match the current filter selection.
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {events.length} of {total} records (Page {page} of {totalPages})
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-900 text-base">Detection Incident Record</h2>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span className="text-slate-500">Event ID:</span>
                <span className="font-mono text-slate-800 font-semibold">{selectedEvent._id}</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span className="text-slate-500">Request Trace ID:</span>
                <span className="font-mono text-slate-800">{selectedEvent.request_id}</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span className="text-slate-500">Monitoring Camera:</span>
                <span className="text-slate-800 font-bold">{selectedEvent.camera_name}</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span className="text-slate-500">Detection Confidence:</span>
                <span className="font-bold text-teal-700">
                  {(selectedEvent.confidence_summary * 100).toFixed(1)}%
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span className="text-slate-500">Processed At (UTC):</span>
                <span className="font-mono text-slate-700">{selectedEvent.processed_at}</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span className="text-slate-500">Local Display Time:</span>
                <span className="text-slate-700 font-medium">
                  {new Date(selectedEvent.processed_at).toLocaleString()}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span>
                  Status:{' '}
                  {selectedEvent.acknowledged ? (
                    <strong className="text-emerald-600">Acknowledged</strong>
                  ) : (
                    <strong className="text-red-600">Pending Review</strong>
                  )}
                </span>
                {!selectedEvent.acknowledged && (
                  <button
                    onClick={() => handleAcknowledge(selectedEvent._id)}
                    className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold cursor-pointer"
                  >
                    Mark Acknowledged
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
