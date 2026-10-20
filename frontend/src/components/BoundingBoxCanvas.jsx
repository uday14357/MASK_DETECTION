import React, { useEffect, useRef } from 'react';

/**
 * Renders normalized bounding boxes onto an HTML5 canvas overlay aligned with video or image.
 * Uses exact aspect-ratio calculation to account for letterbox/pillarbox in object-contain video containers.
 * Color standards from specification:
 * - Green (#16A34A): Mask
 * - Red (#DC2626): No Mask
 * - Amber (#F59E0B): Uncertain
 */
export default function BoundingBoxCanvas({
  detections = [],
  width = 640,
  height = 480,
  videoRef = null,
  isMirrored = false,
  className = '',
  warning = null
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Dynamically match canvas internal pixel buffer to its rendered DOM dimensions
    const rect = canvas.getBoundingClientRect();
    const displayW = Math.round(rect.width) || width || 640;
    const displayH = Math.round(rect.height) || height || 480;

    if (canvas.width !== displayW || canvas.height !== displayH) {
      canvas.width = displayW;
      canvas.height = displayH;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!detections || detections.length === 0) return;

    // Calculate actual content area if letterboxed/pillarboxed inside an object-contain video element
    const video = videoRef?.current;
    let renderW = displayW;
    let renderH = displayH;
    let offsetX = 0;
    let offsetY = 0;

    if (video && video.videoWidth && video.videoHeight) {
      const vRatio = video.videoWidth / video.videoHeight;
      const cRatio = displayW / displayH;

      if (cRatio > vRatio) {
        // Pillarboxed: black bars on left and right
        renderH = displayH;
        renderW = displayH * vRatio;
        offsetX = (displayW - renderW) / 2;
        offsetY = 0;
      } else {
        // Letterboxed: black bars on top and bottom
        renderW = displayW;
        renderH = displayW / vRatio;
        offsetX = 0;
        offsetY = (displayH - renderH) / 2;
      }
    }

    detections.forEach((det) => {
      const { label, confidence, bbox } = det;
      if (!bbox) return;

      // Color selection
      let strokeColor = '#16A34A'; // Green for mask
      let labelBgColor = '#16A34A';
      let labelText = `Mask: ${(confidence * 100).toFixed(0)}%`;

      if (label === 'no_mask') {
        strokeColor = '#DC2626'; // Red
        labelBgColor = '#DC2626';
        labelText = `No Mask: ${(confidence * 100).toFixed(0)}%`;
      } else if (label === 'uncertain') {
        strokeColor = '#F59E0B'; // Amber
        labelBgColor = '#F59E0B';
        labelText = `Uncertain: ${(confidence * 100).toFixed(0)}%`;
      }

      // Convert normalized coordinates (0-1) to pixel coordinates
      let bx = offsetX + (isMirrored ? (1.0 - (bbox.x + bbox.width)) : bbox.x) * renderW;
      let by = offsetY + bbox.y * renderH;
      let bw = bbox.width * renderW;
      let bh = bbox.height * renderH;

      // Draw bounding box with rounded corners and glowing outline
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = strokeColor;
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, 6) : ctx.rect(bx, by, bw, bh);
      ctx.stroke();
      ctx.restore();

      // Draw label background pill
      ctx.save();
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      const textMetrics = ctx.measureText(labelText);
      const pillWidth = textMetrics.width + 16;
      const pillHeight = 22;
      const pillX = Math.max(offsetX, Math.min(bx, offsetX + renderW - pillWidth));
      const pillY = Math.max(offsetY, by - pillHeight - 4);

      ctx.fillStyle = labelBgColor;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 4) : ctx.rect(pillX, pillY, pillWidth, pillHeight);
      ctx.fill();

      // Draw label text
      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, pillX + 8, pillY + pillHeight / 2);
      ctx.restore();
    });

    // Draw demo watermark if applicable
    if (warning) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(10, 10, 240, 26);
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText(warning, 18, 27);
      ctx.restore();
    }
  }, [detections, width, height, videoRef, isMirrored, warning]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`absolute inset-0 pointer-events-none z-10 w-full h-full ${className}`}
    />
  );
}
