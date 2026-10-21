import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video,
  Image as ImageIcon,
  Camera,
  AlertTriangle,
  BarChart3,
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { api } from '../services/api';
import StatCard from '../components/StatCard';

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [timeframe, setTimeframe] = useState(7);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  const fetchDashboardData = async () => {
    try {
      setError(null);
      const [sumRes, trendRes, evRes, camRes] = await Promise.all([
        api.getAnalyticsSummary(timeframe),
        api.getAnalyticsTrends(timeframe),
        api.getEvents({ limit: 5 }),
        api.getCameras()
      ]);
      setSummary(sumRes);
      setTrends(trendRes?.trends || []);
      setRecentEvents(evRes?.events || []);
      setCameras(camRes || []);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError(err.message || 'Failed to fetch dashboard metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [timeframe]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleAcknowledge = async (eventId) => {
    try {
      await api.acknowledgeEvent(eventId);
      fetchDashboardData();
    } catch (err) {
      console.error('Acknowledge failed:', err);
    }
  };

  // Pie chart data
  const pieData = summary
    ? [
        { name: 'Mask Detected', value: summary.mask_detected_count, color: '#16A34A' },
        { name: 'No Mask', value: summary.no_mask_detected_count, color: '#DC2626' },
        { name: 'Uncertain', value: summary.uncertain_count, color: '#F59E0B' },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-6">
      {/* Top Header / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time compliance KPIs and computer-vision surveillance metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(Number(e.target.value))}
            className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 shadow-2xs text-slate-700 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
          </select>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchDashboardData} className="underline font-bold">
            Retry
          </button>
        </div>
      )}

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => navigate('/live-detection')}
          className="flex items-center gap-3 p-3.5 rounded-xl bg-teal-50/80 hover:bg-teal-100/80 border border-teal-200/80 transition-all text-left cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 block group-hover:text-teal-900">
              Live Webcam
            </span>
            <span className="text-[11px] text-teal-700 block">Start stream</span>
          </div>
        </button>

        <button
          onClick={() => navigate('/image-analysis')}
          className="flex items-center gap-3 p-3.5 rounded-xl bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200/80 transition-all text-left cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 block group-hover:text-blue-900">
              Analyze Image
            </span>
            <span className="text-[11px] text-blue-700 block">Upload photo</span>
          </div>
        </button>

        <button
          onClick={() => navigate('/cameras')}
          className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 transition-all text-left cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-slate-700 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 block">Cameras</span>
            <span className="text-[11px] text-slate-600 block">{cameras.length} registered</span>
          </div>
        </button>

        <button
          onClick={() => navigate('/analytics')}
          className="flex items-center gap-3 p-3.5 rounded-xl bg-purple-50/80 hover:bg-purple-100/80 border border-purple-200/80 transition-all text-left cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 block group-hover:text-purple-900">
              Reports
            </span>
            <span className="text-[11px] text-purple-700 block">View analytics</span>
          </div>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Events Logged"
          value={loading ? '...' : summary?.total_events ?? 0}
          subtitle={`Recorded over last ${timeframe} days`}
          icon={Clock}
          iconColor="bg-slate-100 text-slate-700"
        />

        <StatCard
          title="Mask Detected"
          value={loading ? '...' : summary?.mask_detected_count ?? 0}
          subtitle="Compliant faces identified"
          icon={CheckCircle2}
          iconColor="bg-emerald-50 text-emerald-600"
          badgeText={summary?.mask_percentage ? `${summary.mask_percentage}%` : '0%'}
          badgeColor="bg-emerald-100 text-emerald-800"
        />

        <StatCard
          title="No Mask Detected"
          value={loading ? '...' : summary?.no_mask_detected_count ?? 0}
          subtitle="Non-compliant faces"
          icon={XCircle}
          iconColor="bg-red-50 text-red-600"
          badgeText={summary?.unacknowledged_alerts ? `${summary.unacknowledged_alerts} Alerts` : 'Normal'}
          badgeColor={summary?.unacknowledged_alerts > 0 ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'}
        />

        <StatCard
          title="Active Cameras"
          value={loading ? '...' : cameras.length}
          subtitle="Monitoring locations"
          icon={Camera}
          iconColor="bg-teal-50 text-teal-600"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Detection Volume Trends</h2>
              <p className="text-xs text-slate-500">Daily mask vs. non-mask detections over time</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Mask
              </span>
              <span className="flex items-center gap-1.5 text-red-700">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> No Mask
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            {trends.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No detection trend data recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMask" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16A34A" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#16A34A" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorNoMask" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#DC2626" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#DC2626" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="mask" stroke="#16A34A" fillOpacity={1} fill="url(#colorMask)" name="Mask" />
                  <Area type="monotone" dataKey="no_mask" stroke="#DC2626" fillOpacity={1} fill="url(#colorNoMask)" name="No Mask" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Classification Breakdown Donut (1 Col) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col">
          <h2 className="text-sm font-bold text-slate-900 mb-1">Compliance Ratio</h2>
          <p className="text-xs text-slate-500 mb-4">Cumulative distribution of classified faces</p>

          <div className="h-56 w-full flex-1">
            {pieData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400">
                <HelpCircle className="w-8 h-8 text-slate-300 mb-2" />
                <span>No classifications recorded yet.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Calculated Compliance:</span>
            <span className="font-bold text-emerald-600">
              {summary?.mask_percentage !== undefined ? `${summary.mask_percentage}%` : '0%'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Events and Camera List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Events Table (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recent Detection Events</h2>
              <p className="text-xs text-slate-500">Latest automated alerts recorded by Mask Detection System</p>
            </div>
            <button
              onClick={() => navigate('/events')}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              View All Events <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            {recentEvents.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No recent alert events logged.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-2.5">Time</th>
                    <th className="py-2.5">Source</th>
                    <th className="py-2.5">Status</th>
                    <th className="py-2.5">Confidence</th>
                    <th className="py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentEvents.map((ev) => (
                    <tr key={ev._id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 font-medium text-slate-700">
                        {new Date(ev.processed_at).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 text-slate-600">{ev.camera_name || 'Webcam'}</td>
                      <td className="py-2.5">
                        {ev.labels_summary?.no_mask > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-semibold text-[10px]">
                            No Mask ({ev.labels_summary.no_mask})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                            Mask ({ev.labels_summary?.mask || 0})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-slate-600">
                        {(ev.confidence_summary * 100).toFixed(0)}%
                      </td>
                      <td className="py-2.5 text-right">
                        {ev.acknowledged ? (
                          <span className="text-[11px] text-slate-400 font-medium">Acknowledged</span>
                        ) : (
                          <button
                            onClick={() => handleAcknowledge(ev._id)}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Acknowledge
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Registered Cameras Status (1 Col) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Camera Status</h2>
              <p className="text-xs text-slate-500">Connected video endpoints</p>
            </div>
            <button
              onClick={() => navigate('/cameras')}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              Manage <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {cameras.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No cameras registered.
              </div>
            ) : (
              cameras.slice(0, 4).map((cam) => (
                <div key={cam._id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{cam.name}</p>
                      <span className="text-[10px] text-slate-500 truncate block">{cam.location}</span>
                    </div>
                  </div>
                  <div>
                    {cam.status === 'active' ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold">
                        Setup Req.
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
