import React, { useEffect, useRef } from 'react';

/**
 * Renders normalized bounding boxes onto an HTML5 canvas overlay aligned with video or image.
 * Color standards from specification:
 * - Green (#16A34A): Mask
 * - Red (#DC2626): No Mask
 * - Amber (#F59E0B): Uncertain
 */
export default function BoundingBoxCanvas({
  detections = [],
  width = 640,
  height = 480,
  isMirrored = false,
  className = '',
  warning = null
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!detections || detections.length === 0) return;

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

      // Convert coordinates (normalized 0-1) to canvas pixels
      let bx = bbox.x * canvas.width;
      let by = bbox.y * canvas.height;
      let bw = bbox.width * canvas.width;
      let bh = bbox.height * canvas.height;

      // Adjust for mirrored preview if needed
      if (isMirrored) {
        bx = canvas.width - (bx + bw);
      }

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
      const pillX = bx;
      const pillY = Math.max(0, by - pillHeight - 4);

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
  }, [detections, width, height, isMirrored, warning]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`absolute inset-0 pointer-events-none z-10 w-full h-full ${className}`}
    />
  );
}
