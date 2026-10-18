import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  CheckCircle2,
  XCircle,
  HelpCircle,
  TrendingUp,
  Camera,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { api } from '../services/api';
import StatCard from '../components/StatCard';

export default function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState(7);
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [cameraStats, setCameraStats] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [sumRes, trendRes, camRes] = await Promise.all([
        api.getAnalyticsSummary(timeframe),
        api.getAnalyticsTrends(timeframe),
        api.getAnalyticsCameras()
      ]);
      setSummary(sumRes);
      setTrends(trendRes?.trends || []);
      setCameraStats(camRes?.cameras || []);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeframe]);

  const handleExportCsv = async () => {
    try {
      const blob = await api.exportEventsCsv({});
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance_report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Compliance Analytics & Reports</h1>
          <p className="text-xs text-slate-500 mt-1">
            Historical mask detection statistics and facility-wide compliance trends.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(Number(e.target.value))}
            className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 shadow-2xs text-slate-700"
          >
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV Report
          </button>
        </div>
      </div>

      {/* Compliance Disclaimer */}
      <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
        <TrendingUp className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <strong>Compliance Calculation Formula:</strong>
          <code className="mx-1 px-1.5 py-0.5 rounded bg-blue-100 font-mono text-[11px]">
            Mask % = Mask Detections / (Mask Detections + No-Mask Detections) × 100
          </code>
          <p className="text-[11px] text-blue-800/80 mt-0.5">
            *All analytics represent historical frame classifications. Detections reflect visible mask compliance, not persistent individual person tracking.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Overall Compliance Rate"
          value={summary?.mask_percentage !== undefined ? `${summary.mask_percentage}%` : '0%'}
          subtitle="Compliant vs Non-compliant"
          icon={CheckCircle2}
          iconColor="bg-emerald-50 text-emerald-600"
        />

        <StatCard
          title="Total Faces Classified"
          value={summary?.total_faces ?? 0}
          subtitle={`Processed over ${timeframe} days`}
          icon={Layers}
          iconColor="bg-blue-50 text-blue-600"
        />

        <StatCard
          title="Mask Detected"
          value={summary?.mask_detected_count ?? 0}
          subtitle="Faces with proper mask"
          icon={CheckCircle2}
          iconColor="bg-teal-50 text-teal-600"
        />

        <StatCard
          title="No Mask Incidents"
          value={summary?.no_mask_detected_count ?? 0}
          subtitle="Unmasked infractions"
          icon={XCircle}
          iconColor="bg-red-50 text-red-600"
        />
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Percentage Line Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <h2 className="text-sm font-bold text-slate-900 mb-1">Daily Compliance Percentage</h2>
          <p className="text-xs text-slate-500 mb-4">Tracking facility safety trendline over time</p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  formatter={(val) => [`${val}%`, 'Compliance']}
                />
                <Line
                  type="monotone"
                  dataKey="mask_percentage"
                  stroke="#0D9488"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#0D9488' }}
                  name="Compliance %"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stacked Breakdown Bar Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <h2 className="text-sm font-bold text-slate-900 mb-1">Detection Classification Volumes</h2>
          <p className="text-xs text-slate-500 mb-4">Volume comparison by detection category</p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="mask" stackId="a" fill="#16A34A" name="Mask" />
                <Bar dataKey="no_mask" stackId="a" fill="#DC2626" name="No Mask" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Camera-wise Compliance Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-1">Camera Location Comparisons</h2>
        <p className="text-xs text-slate-500 mb-4">Breakdown by monitoring sensor and department</p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Camera Name</th>
                <th className="py-2.5 px-3">Total Events</th>
                <th className="py-2.5 px-3">Mask On</th>
                <th className="py-2.5 px-3">No Mask</th>
                <th className="py-2.5 px-3">Compliance %</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cameraStats.map((cam) => (
                <tr key={cam.camera_id} className="hover:bg-slate-50/60">
                  <td className="py-2.5 px-3 font-semibold text-slate-800">{cam.camera_name}</td>
                  <td className="py-2.5 px-3 text-slate-600">{cam.total_events}</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-medium">{cam.mask_count}</td>
                  <td className="py-2.5 px-3 text-red-700 font-medium">{cam.no_mask_count}</td>
                  <td className="py-2.5 px-3">
                    <span className="font-bold text-slate-900">{cam.mask_percentage}%</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold capitalize">
                      {cam.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {cameraStats.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400">
              No camera breakdown data available yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
