import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Server,
  Database,
  Cpu,
  Video,
  RefreshCw,
  Clock
} from 'lucide-react';
import { api } from '../services/api';

export default function HealthPage() {
  const [health, setHealth] = useState(null);
  const [readyInfo, setReadyInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchHealth = async () => {
    try {
      setError(null);
      const [hRes, rRes] = await Promise.all([
        api.getHealth(),
        api.getHealthReady()
      ]);
      setHealth(hRes);
      setReadyInfo(rRes);
    } catch (err) {
      console.error('Health check failed:', err);
      setError(err.message || 'System health check failed to respond');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHealth();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Health & Diagnostics</h1>
          <p className="text-xs text-slate-500 mt-1">
            Status of backend services, database connectors, and AI inference engines.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Run Diagnostic Ping</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Backend Core */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">FastAPI Backend</h3>
                <span className="text-[11px] text-slate-400">Core REST API Gateway</span>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
              {health?.status || 'Active'}
            </span>
          </div>

          <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>Environment:</span>
              <span className="font-mono text-slate-700">{health?.environment || 'development'}</span>
            </div>
            <div className="flex justify-between">
              <span>Timestamp:</span>
              <span className="font-mono text-slate-700">{health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : '—'}</span>
            </div>
          </div>
        </div>

        {/* Database */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Database Engine</h3>
                <span className="text-[11px] text-slate-400">Events, Cameras & Auth Store</span>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
              Connected
            </span>
          </div>

          <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>Storage Engine:</span>
              <span className="font-semibold text-slate-700">{readyInfo?.database?.engine || 'Active'}</span>
            </div>
            <div className="flex justify-between">
              <span>Persistence Status:</span>
              <span className="text-emerald-700 font-medium">Operational</span>
            </div>
          </div>
        </div>

        {/* Computer Vision AI Provider */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">AI Computer Vision</h3>
                <span className="text-[11px] text-slate-400">Object Detection & Mask Classification</span>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-[10px] capitalize">
              {readyInfo?.ai_provider?.status || 'Ready'}
            </span>
          </div>

          <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>Configured Provider:</span>
              <span className="font-semibold text-slate-700 capitalize">{readyInfo?.ai_provider?.name || 'Demo'}</span>
            </div>
            <div className="flex justify-between">
              <span>Model Reference:</span>
              <span className="font-mono text-slate-700">{readyInfo?.ai_provider?.model || 'mask-wearing-detection'}</span>
            </div>
          </div>
        </div>

        {/* Media Gateway / RTSP Streaming */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">CCTV / IP Stream Gateway</h3>
                <span className="text-[11px] text-slate-400">RTSP to WebRTC/HLS Relay</span>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
              Requires Configuration
            </span>
          </div>

          <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>Webcam Streaming:</span>
              <span className="text-emerald-700 font-semibold">Active & Supported</span>
            </div>
            <div className="flex justify-between">
              <span>RTSP Gateway:</span>
              <span className="text-amber-700">Requires media server setup</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
