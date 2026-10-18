import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Shield,
  Sliders,
  Clock,
  HardDrive,
  Eye,
  CheckCircle2,
  AlertCircle,
  Lock
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.60);
  const [alertCooldown, setAlertCooldown] = useState(15);
  const [frameInterval, setFrameInterval] = useState(800);
  const [retentionDays, setRetentionDays] = useState(30);
  const [imageRetention, setImageRetention] = useState(false);
  const [aiProviderInfo, setAiProviderInfo] = useState({ provider: 'demo', model: 'default' });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const { isAdmin } = useAuth();

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getSettings();
      if (data) {
        setConfidenceThreshold(data.confidence_threshold);
        setAlertCooldown(data.alert_cooldown_seconds);
        setFrameInterval(data.frame_interval_ms);
        setRetentionDays(data.retention_days);
        setImageRetention(data.image_retention_enabled);
        setAiProviderInfo({
          provider: data.ai_provider,
          model: data.ai_model,
        });
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await api.updateSettings({
        confidence_threshold: confidenceThreshold,
        alert_cooldown_seconds: alertCooldown,
        frame_interval_ms: frameInterval,
        retention_days: retentionDays,
        image_retention_enabled: imageRetention,
      });
      setSuccessMsg('Settings saved successfully to system database.');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Settings & Privacy</h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure detection sensitivity, automated alert cooldowns, and data retention rules.
        </p>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Detection Engine Parameters */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Sliders className="w-4 h-4 text-teal-600" />
            <h2 className="font-bold text-slate-900 text-sm">Computer Vision Thresholds</h2>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
              <span>Detection Confidence Threshold</span>
              <span className="font-mono text-teal-700 text-sm">
                {(confidenceThreshold * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={0.2}
              max={0.95}
              step={0.05}
              disabled={!isAdmin}
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Minimum AI confidence required before a face classification is confirmed and candidate events are created.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
              <span>Alert Deduplication Cooldown</span>
              <span className="font-mono text-teal-700 text-sm">{alertCooldown} seconds</span>
            </div>
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              disabled={!isAdmin}
              value={alertCooldown}
              onChange={(e) => setAlertCooldown(Number(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Suppress repeated alert logs for the same camera within this window to prevent alert flooding.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
              <span>Frame Processing Interval</span>
              <span className="font-mono text-teal-700 text-sm">{frameInterval} ms</span>
            </div>
            <input
              type="range"
              min={400}
              max={2500}
              step={100}
              disabled={!isAdmin}
              value={frameInterval}
              onChange={(e) => setFrameInterval(Number(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Conservative frame frequency target for live stream analysis.
            </p>
          </div>
        </div>

        {/* Data Retention & Privacy Controls */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <HardDrive className="w-4 h-4 text-teal-600" />
            <h2 className="font-bold text-slate-900 text-sm">Data Retention & Storage</h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Event History Retention (Days)
            </label>
            <input
              type="number"
              min={1}
              max={365}
              disabled={!isAdmin}
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              className="w-48 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Audit events older than this period are queued for automated pruning.
            </p>
          </div>

          <div className="pt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={imageRetention}
                onChange={(e) => setImageRetention(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded border-slate-300 mt-0.5"
              />
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Enable Raw Image Snapshot Retention
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Disabled by default. When disabled, images and frames are processed strictly in volatile memory and purged immediately.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Provider Environment Status (Read-Only) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Lock className="w-4 h-4 text-teal-600" />
            <h2 className="font-bold text-slate-900 text-sm">AI Provider Configuration</h2>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-lg text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Active Engine:</span>
              <span className="font-bold text-slate-900 capitalize">{aiProviderInfo.provider}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Model Identifier:</span>
              <span className="font-mono text-slate-700">{aiProviderInfo.model}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Secret Management:</span>
              <span className="text-emerald-700 font-semibold">Configured via Server Environment (Protected)</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            *In accordance with security standards, AI API keys and database credentials cannot be modified via the frontend. Configure them in <code>backend/.env</code>.
          </p>
        </div>

        {/* Privacy Policy and Compliance Guidance */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 text-xs text-slate-600 space-y-3">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-teal-600" />
            Privacy & Compliance Notice
          </h3>
          <p className="leading-relaxed">
            MaskGuard AI is strictly designed as an operational safety and compliance monitoring tool. It performs object detection and mask classification only. The system does not perform facial recognition, demographic profiling, person identification, or store biometric fingerprints.
          </p>
          <p className="leading-relaxed">
            Webcam access is requested only upon explicit user action and is immediately terminated when camera monitoring is stopped or when the user navigates away from the monitoring interface.
          </p>
        </div>

        {isAdmin && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
