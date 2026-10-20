import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Video,
  VideoOff,
  Eye,
  BellRing,
  Layers,
  Lock,
  ArrowRight,
  Server,
  Activity,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileSpreadsheet,
  RotateCcw,
  Camera,
  Play,
  Zap,
  Sliders
} from 'lucide-react';
import { api } from '../services/api';
import BoundingBoxCanvas from '../components/BoundingBoxCanvas';

export default function LandingPage() {
  const navigate = useNavigate();

  // Embedded Camera Preview State
  const [cameraActive, setCameraActive] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [permissionError, setPermissionError] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [detections, setDetections] = useState([]);
  const [summary, setSummary] = useState({
    faces_detected: 0,
    mask_count: 0,
    no_mask_count: 0,
    uncertain_count: 0
  });
  const [latency, setLatency] = useState(null);
  const [warningText, setWarningText] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const isProcessingRef = useRef(false);
  const timerRef = useRef(null);
  const latestFrameIdRef = useRef(0);

  const stopCamera = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setDetections([]);
    setSummary({ faces_detected: 0, mask_count: 0, no_mask_count: 0, uncertain_count: 0 });
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setPermissionError(null);
    setAiError(null);
    try {
      const constraints = {
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      console.error('Camera error:', err);
      let msg = 'Could not access the webcam.';
      if (err.name === 'NotAllowedError') {
        msg = 'Camera permission was denied. Please allow camera access in your browser.';
      } else if (err.name === 'NotFoundError') {
        msg = 'No video camera detected on your device.';
      }
      setPermissionError(msg);
      setCameraActive(false);
    }
  };

  const analyzePreviewFrame = useCallback(async () => {
    if (!videoRef.current || !cameraActive || isProcessingRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0) return;

    const currentFrameId = ++latestFrameIdRef.current;

    try {
      isProcessingRef.current = true;
      let targetW = video.videoWidth || 640;
      let targetH = video.videoHeight || 480;
      const maxDim = 640;
      if (targetW > maxDim) {
        targetH = Math.round((targetH * maxDim) / targetW);
        targetW = maxDim;
      }
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, targetW, targetH);

      const base64Data = canvas.toDataURL('image/jpeg', 0.80);
      const startT = performance.now();
      const res = await api.detectFrame(base64Data, 'webcam', 'cam-default-webcam');
      const roundTrip = Math.round(performance.now() - startT);

      // Discard stale/out-of-order response if a newer frame has already begun
      if (currentFrameId < latestFrameIdRef.current) {
        return;
      }

      setDetections(res.detections || []);
      setSummary(res.summary || { faces_detected: 0, mask_count: 0, no_mask_count: 0, uncertain_count: 0 });
      setLatency(res.latency_ms || roundTrip);
      setWarningText(res.warning || null);
      setAiError(null);
    } catch (err) {
      if (currentFrameId >= latestFrameIdRef.current) {
        setAiError(err.message || 'Frame processing error');
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [cameraActive]);

  useEffect(() => {
    if (!cameraActive) return;
    let isMounted = true;
    const loop = async () => {
      if (!isMounted) return;
      await analyzePreviewFrame();
      if (isMounted) {
        timerRef.current = setTimeout(loop, 250);
      }
    };
    loop();
    return () => {
      isMounted = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [cameraActive, analyzePreviewFrame]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* Navigation (Sign In Removed) */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-xl text-brand-navy tracking-tight">MaskGuard AI</span>
              <span className="text-xs text-brand-teal font-semibold block leading-none">Smart Safety Vision</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="#live-preview-section"
              className="hidden sm:inline-flex px-4 py-2 text-xs font-semibold text-slate-700 hover:text-brand-navy transition-colors"
            >
              Live Camera Demo
            </a>
            <Link
              to="/dashboard"
              className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs hover:shadow transition-all flex items-center gap-2"
            >
              Open Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-white to-slate-100/60 pt-16 pb-16 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold mb-6 shadow-2xs">
            <Activity className="w-4 h-4 text-teal-600" />
            Enterprise Computer Vision & Compliance Monitoring
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-brand-navy tracking-tight leading-tight">
            Smarter Monitoring. <span className="text-brand-teal">Safer Spaces.</span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            MaskGuard AI delivers automated face-mask classification and real-time compliance tracking across hospital wards,
            laboratories, cleanrooms, and workplaces using computer vision.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#live-preview-section"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Video className="w-4 h-4" />
              Try Live Camera Preview
            </a>
            <Link
              to="/dashboard"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-brand-navy hover:bg-brand-navyLight text-white font-semibold text-sm shadow-xs transition-all flex items-center justify-center gap-2"
            >
              Launch Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            *Assistance and safety monitoring tool. Does not replace human regulatory judgment or provide medical certification.
          </p>
        </div>
      </section>

      {/* Interactive Live Camera Preview Section on Homepage */}
      <section id="live-preview-section" className="py-16 bg-white border-b border-slate-200 scroll-mt-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-bold uppercase tracking-wider mb-2">
              <Camera className="w-3.5 h-3.5" />
              Interactive Feed
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-brand-navy">
              Live AI Detection Preview
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-600">
              Start your webcam right here to test real-time face classification, bounding box tracking, and compliance metrics.
            </p>
          </div>

          {/* Camera Canvas Container */}
          <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-xl border border-slate-800 relative flex flex-col justify-center items-center min-h-[380px] max-h-[520px]">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full max-h-[480px] object-contain transition-transform ${
                isMirrored ? 'scale-x-[-1]' : ''
              } ${!cameraActive ? 'hidden' : 'block'}`}
            />

            {cameraActive && (
              <BoundingBoxCanvas
                detections={detections}
                videoRef={videoRef}
                width={videoRef.current?.videoWidth || 640}
                height={videoRef.current?.videoHeight || 480}
                isMirrored={isMirrored}
                warning={warningText}
              />
            )}

            {/* Offline / Start Prompt */}
            {!cameraActive && (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-teal-400 mb-4 border border-slate-700 shadow-inner">
                  <Camera className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">Webcam Preview Ready</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                  Click below to enable local webcam monitoring. Frames are processed sequentially without storing your video.
                </p>
                <button
                  onClick={startCamera}
                  className="px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Video className="w-4 h-4" />
                  Start Live Camera
                </button>
              </div>
            )}

            {/* In-feed HUD */}
            {cameraActive && (
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
                <div className="bg-slate-950/80 backdrop-blur-xs border border-slate-800 px-3 py-1.5 rounded-lg text-[11px] text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-mono">Processing Active</span>
                </div>
                {latency && (
                  <div className="bg-slate-950/80 backdrop-blur-xs border border-slate-800 px-3 py-1.5 rounded-lg text-[11px] text-white flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-teal-400" />
                    <span className="font-mono text-slate-300">{latency} ms</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Camera Controls & Live Counters */}
          {cameraActive && (
            <div className="mt-4 p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-slate-400" />
                  <span>Faces: {summary.faces_detected}</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Mask: {summary.mask_count}</span>
                </div>
                <div className="flex items-center gap-1.5 text-red-700 font-semibold">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span>No Mask: {summary.no_mask_count}</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-700 font-semibold">
                  <HelpCircle className="w-4 h-4 text-amber-600" />
                  <span>Uncertain: {summary.uncertain_count}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMirrored(!isMirrored)}
                  className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer text-xs"
                  title="Toggle Mirror View"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate('/live-detection')}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                >
                  Open Full Studio
                </button>
                <button
                  onClick={stopCamera}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Stop Preview
                </button>
              </div>
            </div>
          )}

          {permissionError && (
            <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              {permissionError}
            </div>
          )}
        </div>
      </section>

      {/* Three Step Workflow */}
      <section id="how-it-works" className="py-16 bg-slate-50 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-brand-navy">
              Three-Step Compliance Pipeline
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-600">
              Reliable, sequential processing pipeline engineered for low latency and zero duplicate flood.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
              <div className="w-12 h-12 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-lg mb-4">
                1
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-2 flex items-center gap-2">
                <Video className="w-5 h-5 text-teal-600" />
                Live Camera Capture
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Connect browser webcams or upload photos. Video frames are captured sequentially and throttled to prevent API exhaustion.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
              <div className="w-12 h-12 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-lg mb-4">
                2
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-2 flex items-center gap-2">
                <Eye className="w-5 h-5 text-teal-600" />
                AI Mask Classification
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Frames are analyzed by the configured computer-vision model, classifying faces as Mask, No Mask, or Uncertain with confidence scores.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
              <div className="w-12 h-12 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-lg mb-4">
                3
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-2 flex items-center gap-2">
                <BellRing className="w-5 h-5 text-teal-600" />
                Alerts & Audit Logging
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Eligible infractions trigger cooldown-regulated alerts recorded to MongoDB with localized timestamps and CSV reporting.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Overview */}
      <section className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-brand-navy">
              Enterprise Grade Capabilities
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-600">
              Built with security, accuracy, and operational reliability in mind.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-2xs">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-1">Normalized Bounding Boxes</h3>
              <p className="text-xs text-slate-600">
                Pixel-accurate canvas overlays formatted with standard color rules: Green for Mask, Red for No Mask, Amber for Uncertain.
              </p>
            </div>

            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-2xs">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-1">Deduplication Cooldown</h3>
              <p className="text-xs text-slate-600">
                Configurable per-camera cooldown windows prevent transient alert floods and duplicate database writes.
              </p>
            </div>

            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-2xs">
              <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-1">Compliance CSV Export</h3>
              <p className="text-xs text-slate-600">
                Filter recorded events by camera, date range, and mask classification, and export compliance audit reports directly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer (Sign In Removed) */}
      <footer className="mt-auto bg-brand-navy text-slate-400 py-10 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-bold text-white text-base">MaskGuard AI</span>
          </div>

          <p className="text-xs text-slate-400 text-center">
            © {new Date().getFullYear()} MaskGuard AI Systems. All rights reserved. “Smarter Monitoring. Safer Spaces.”
          </p>

          <div className="flex items-center gap-6 text-xs">
            <Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <Link to="/live-detection" className="hover:text-white transition-colors">Live Studio</Link>
            <Link to="/settings" className="hover:text-white transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
