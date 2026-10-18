import React from 'react';

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  badgeText,
  badgeColor = 'bg-blue-50 text-blue-700',
  iconColor = 'text-brand-teal bg-teal-50',
  className = ''
}) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        {Icon && (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-900 tracking-tight">
          {value !== undefined && value !== null ? value : '—'}
        </span>
        {badgeText && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeColor}`}>
            {badgeText}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-slate-500 truncate">
          {subtitle}
        </p>
      )}
    </div>
  );
}
