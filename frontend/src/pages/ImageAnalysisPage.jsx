import React, { useState, useRef } from 'react';
import {
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldCheck,
  RefreshCw,
  Trash2,
  AlertCircle,
  FileCheck
} from 'lucide-react';
import { api } from '../services/api';
import BoundingBoxCanvas from '../components/BoundingBoxCanvas';

export default function ImageAnalysisPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 640, height: 480 });

  const fileInputRef = useRef(null);
  const imageRef = useRef(null);

  const handleFileSelect = (file) => {
    setError(null);
    setResult(null);

    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Unsupported file type. Please upload a JPEG, PNG, or WebP image.');
      return;
    }

    // Validate size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds the 10 MB limit.');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    setImageDimensions({
      width: naturalWidth || 640,
      height: naturalHeight || 480,
    });
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    try {
      setAnalyzing(true);
      setError(null);
      const res = await api.detectImage(selectedFile);
      setResult(res);
    } catch (err) {
      console.error('Image analysis failed:', err);
      setError(err.message || 'Image analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleClear = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Image Analysis</h1>
        <p className="text-xs text-slate-500 mt-1">
          Upload static photos for high-precision face mask classification and bounding-box inspection.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Upload / Viewer Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload & Viewer Container (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          {!previewUrl ? (
            /* Drag and Drop Zone */
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-2xl p-12 text-center bg-white hover:bg-slate-50/50 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[380px]"
            >
              <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-4 shadow-2xs">
                <Upload className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-800 text-base mb-1">
                Drag and drop your image here, or browse
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                Supported formats: JPEG, PNG, WebP. Maximum file size: 10 MB.
              </p>
              <button
                type="button"
                className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-xs"
              >
                Select Image File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
              />
            </div>
          ) : (
            /* Image Preview with Bounding Box Overlay */
            <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-md relative flex justify-center items-center min-h-[380px]">
              <div className="relative inline-block max-w-full">
                <img
                  ref={imageRef}
                  src={previewUrl}
                  alt="Analysis Preview"
                  onLoad={handleImageLoad}
                  className="max-h-[520px] w-auto object-contain block mx-auto"
                />

                {result?.detections && (
                  <BoundingBoxCanvas
                    detections={result.detections}
                    width={imageDimensions.width}
                    height={imageDimensions.height}
                    isMirrored={false}
                    warning={result.warning}
                  />
                )}
              </div>
            </div>
          )}

          {/* Controls Bar */}
          {previewUrl && (
            <div className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl">
              <div className="flex items-center gap-2 text-xs text-slate-600 truncate max-w-xs sm:max-w-md">
                <FileCheck className="w-4 h-4 text-teal-600 shrink-0" />
                <span className="font-semibold truncate">{selectedFile?.name}</span>
                <span className="text-slate-400">
                  ({(selectedFile?.size / (1024 * 1024)).toFixed(2)} MB)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleClear}
                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Remove image"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {analyzing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Analyze Image</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results Sidebar (1 Col) */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
              Analysis Results
            </h2>

            {!result ? (
              <div className="py-8 text-center text-xs text-slate-400">
                {analyzing ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing image with AI detector...</span>
                  </div>
                ) : (
                  <span>Select an image and click "Analyze Image" to view results.</span>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary counts */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-500 block text-[11px]">Total Faces</span>
                    <span className="text-lg font-bold text-slate-900">
                      {result.summary?.faces_detected ?? 0}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200">
                    <span className="text-emerald-800 block text-[11px]">Mask Detected</span>
                    <span className="text-lg font-bold text-emerald-700">
                      {result.summary?.mask_count ?? 0}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-red-50/70 border border-red-200">
                    <span className="text-red-800 block text-[11px]">No Mask</span>
                    <span className="text-lg font-bold text-red-700">
                      {result.summary?.no_mask_count ?? 0}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200">
                    <span className="text-amber-800 block text-[11px]">Uncertain</span>
                    <span className="text-lg font-bold text-amber-700">
                      {result.summary?.uncertain_count ?? 0}
                    </span>
                  </div>
                </div>

                {/* Per-face classifications */}
                <div className="pt-2">
                  <h3 className="text-xs font-bold text-slate-700 mb-2">Classified Face Instances</h3>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {result.detections?.length === 0 ? (
                      <p className="text-xs text-slate-400">No faces were identified in this photo.</p>
                    ) : (
                      result.detections?.map((d, index) => (
                        <div
                          key={index}
                          className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs"
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
                              Face #{index + 1}: {d.label.replace('_', ' ')}
                            </span>
                          </div>
                          <span className="font-mono text-slate-600 font-medium">
                            {(d.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Processing metadata */}
                <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 space-y-1">
                  <div>Request ID: <span className="font-mono text-slate-600">{result.request_id}</span></div>
                  <div>Latency: <span className="font-mono text-slate-600">{result.latency_ms} ms</span></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
