import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Video,
  VideoOff,
  Play,
  Pause,
  Camera,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldCheck,
  Zap,
  Activity,
  Sliders
} from 'lucide-react';
import { api } from '../services/api';
import BoundingBoxCanvas from '../components/BoundingBoxCanvas';

export default function LiveDetectionPage() {
  const [cameraActive, setCameraActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [frameInterval, setFrameInterval] = useState(800); // 800ms default
  const [permissionError, setPermissionError] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [warningText, setWarningText] = useState(null);

  // Detection stats
  const [detections, setDetections] = useState([]);
  const [summary, setSummary] = useState({
    faces_detected: 0,
    mask_count: 0,
    no_mask_count: 0,
    uncertain_count: 0,
  });
  const [lastProcessedAt, setLastProcessedAt] = useState(null);
  const [latency, setLatency] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // References
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const isAnalyzingRef = useRef(analyzing);
  const isProcessingFrameRef = useRef(false);
  const analysisTimerRef = useRef(null);
  const latestFrameIdRef = useRef(0);

  isAnalyzingRef.current = analyzing;

  // Cleanup tracks on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setPermissionError(null);
    setAiError(null);
    try {
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);
      setAnalyzing(true);
    } catch (err) {
      console.error('Camera access error:', err);
      let msg = 'Could not access the webcam.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission was denied. Please allow camera access in your browser settings to continue.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No video camera was found on your device.';
      } else if (err.name === 'NotReadableError') {
        msg = 'Camera is already in use by another application.';
      }
      setPermissionError(msg);
      setCameraActive(false);
      setAnalyzing(false);
    }
  };

  const stopCamera = () => {
    if (analysisTimerRef.current) {
      clearTimeout(analysisTimerRef.current);
      analysisTimerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
    setAnalyzing(false);
    setDetections([]);
    setSummary({
      faces_detected: 0,
      mask_count: 0,
      no_mask_count: 0,
      uncertain_count: 0,
    });
  };

  const captureFrameAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !cameraActive || isProcessingFrameRef.current) {
      return;
    }

    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0) {
      return;
    }

    const currentFrameId = ++latestFrameIdRef.current;

    try {
      isProcessingFrameRef.current = true;

      // Render frame to optimized offscreen canvas (max 640px width preserving aspect ratio)
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

      const startTime = performance.now();
      const response = await api.detectFrame(base64Data, 'webcam', 'cam-default-webcam');
      const roundTripLatency = Math.round(performance.now() - startTime);

      // Discard out-of-order or stale response if a newer frame has already begun
      if (currentFrameId < latestFrameIdRef.current) {
        return;
      }

      setDetections(response.detections || []);
      setSummary(
        response.summary || {
          faces_detected: 0,
          mask_count: 0,
          no_mask_count: 0,
          uncertain_count: 0,
        }
      );
      setLastProcessedAt(response.processed_at);
      setLatency(response.latency_ms || roundTripLatency);
      setIsDemoMode(response.is_demo || false);
      setWarningText(response.warning || null);
      setAiError(null);
    } catch (err) {
      if (currentFrameId >= latestFrameIdRef.current) {
        console.error('Frame analysis failed:', err);
        setAiError(err.message || 'Detection request failed');
      }
    } finally {
      isProcessingFrameRef.current = false;
    }
  }, [cameraActive]);

  // Sequential processing loop: waits for current analysis to complete before scheduling next
  useEffect(() => {
    if (!cameraActive || !analyzing) {
      if (analysisTimerRef.current) {
        clearTimeout(analysisTimerRef.current);
        analysisTimerRef.current = null;
      }
      return;
    }

    let isSubscribed = true;

    const runLoop = async () => {
      if (!isSubscribed) return;
      await captureFrameAndAnalyze();
      if (isSubscribed && isAnalyzingRef.current) {
        analysisTimerRef.current = setTimeout(runLoop, Math.min(frameInterval, 250));
      }
    };

    runLoop();

    return () => {
      isSubscribed = false;
      if (analysisTimerRef.current) {
        clearTimeout(analysisTimerRef.current);
      }
    };
  }, [cameraActive, analyzing, frameInterval, captureFrameAndAnalyze]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Live Face Mask Monitoring</span>
            {cameraActive && analyzing && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                LIVE
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time multi-face mask classification via laptop webcam.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {!cameraActive ? (
            <button
              onClick={startCamera}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Video className="w-4 h-4" />
              Start Camera
            </button>
          ) : (
            <>
              <button
                onClick={() => setAnalyzing(!analyzing)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  analyzing
                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                }`}
              >
                {analyzing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {analyzing ? 'Pause Analysis' : 'Resume Analysis'}
              </button>

              <button
                onClick={captureFrameAndAnalyze}
                disabled={isProcessingFrameRef.current}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                title="Trigger immediate frame analysis"
              >
                <Camera className="w-3.5 h-3.5" />
                Capture Now
              </button>

              <button
                onClick={() => setIsMirrored(!isMirrored)}
                className={`p-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                  isMirrored
                    ? 'bg-slate-200 text-slate-800 border-slate-400'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
                title="Toggle mirror view"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={stopCamera}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
              >
                <VideoOff className="w-4 h-4" />
                Stop Camera
              </button>
            </>
          )}
        </div>
      </div>

      {/* Permission or AI Warning Banners */}
      {permissionError && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <h2 className="font-bold text-amber-900">Camera Access Notice</h2>
            <p className="mt-0.5">{permissionError}</p>
          </div>
        </div>
      )}

      {aiError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
          <div>
            <h2 className="font-bold text-red-900">AI Service Diagnostic</h2>
            <p className="mt-0.5">{aiError}</p>
          </div>
        </div>
      )}

      {isDemoMode && (
        <div className="p-3.5 rounded-xl bg-slate-900 border border-amber-400/40 text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-bold tracking-wide uppercase">DEMO MODE ACTIVE</span>
            <span className="text-slate-400 hidden sm:inline">— Realistic offline vision testing. Configure Roboflow API key in backend/.env for production model.</span>
          </div>
        </div>
      )}

      {/* Main Monitoring Screen */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Video Frame Canvas (3 Cols) */}
        <div className="lg:col-span-3 bg-slate-900 rounded-2xl overflow-hidden shadow-lg border border-slate-800 relative flex flex-col justify-center items-center min-h-[420px]">
          {/* Native HTML5 Video */}
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full max-h-[580px] object-contain transition-transform ${
              isMirrored ? 'scale-x-[-1]' : ''
            } ${!cameraActive ? 'hidden' : 'block'}`}
          />

          {/* Canvas Bounding Box Overlay */}
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

          {/* Camera Idle State */}
          {!cameraActive && (
            <div className="p-8 text-center text-slate-400 flex flex-col items-center max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 mb-4 border border-slate-700">
                <Video className="w-8 h-8" />
              </div>
              <h2 className="text-base font-bold text-white mb-1">Webcam Inactive</h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Click "Start Camera" above to grant webcam access. Your browser video stream will be processed locally and analyzed sequentially.
              </p>
              <button
                onClick={startCamera}
                className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Start Camera
              </button>
            </div>
          )}

          {/* Stream Overlay HUD */}
          {cameraActive && (
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
              <div className="bg-slate-950/80 backdrop-blur-xs border border-slate-800 px-3 py-1.5 rounded-lg text-[11px] text-white flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${analyzing ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span className="font-mono">{analyzing ? 'Analyzing Frames' : 'Analysis Paused'}</span>
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

        {/* Live Detection Status Sidebar (1 Col) */}
        <div className="space-y-4">
          {/* Real-time Counts */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Current Frame Classification
            </h2>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <ShieldCheck className="w-4 h-4 text-slate-500" />
                  <span>Total Faces:</span>
                </div>
                <span className="text-base font-bold text-slate-900">{summary.faces_detected}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/60">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Mask On:</span>
                </div>
                <span className="text-base font-bold text-emerald-700">{summary.mask_count}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-50/70 border border-red-200/60">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-900">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span>No Mask:</span>
                </div>
                <span className="text-base font-bold text-red-700">{summary.no_mask_count}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/60">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                  <HelpCircle className="w-4 h-4 text-amber-600" />
                  <span>Uncertain:</span>
                </div>
                <span className="text-base font-bold text-amber-700">{summary.uncertain_count}</span>
              </div>
            </div>
          </div>

          {/* Detections List */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Detected Face Objects
            </h2>

            {detections.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">No faces visible in current frame.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {detections.map((d, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          d.label === 'mask'
                            ? 'bg-emerald-500'
                            : d.label === 'no_mask'
                            ? 'bg-red-500'
                            : 'bg-amber-500'
                        }`}
                      />
                      <span className="font-semibold capitalize text-slate-800">
                        {d.label.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="font-mono text-slate-500 text-[11px]">
                      {(d.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Processing Settings Control */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs text-xs space-y-3">
            <div className="flex items-center justify-between font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                Frame Frequency
              </span>
              <span className="font-mono text-teal-700">{frameInterval} ms</span>
            </div>
            <input
              type="range"
              min={400}
              max={2000}
              step={100}
              value={frameInterval}
              onChange={(e) => setFrameInterval(Number(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Faster (400ms)</span>
              <span>Conservative (2000ms)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
