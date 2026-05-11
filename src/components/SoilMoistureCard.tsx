import React, { useEffect, useMemo, useState } from 'react';
import { Droplets, RefreshCw } from 'lucide-react';
import { generateSoilMoisture } from '../services/SoilMoistureService';
import { clsx } from 'clsx';

type Props = {
  soilType?: string | null;
  season?: string | null;
  weatherCondition?: string;
  recentRainfall?: boolean;
  compact?: boolean;
};

function normalizeSoilType(soilType?: string | null): string {
  const raw = (soilType || '').trim();
  if (!raw) return 'Loamy';
  if (raw === 'Loam') return 'Loamy';
  if (raw === 'Loamy') return 'Loamy';
  if (raw === 'Sandy') return 'Sandy';
  if (raw === 'Clay') return 'Clay';
  return raw;
}

function normalizeSeason(season?: string | null): string {
  const raw = (season || '').trim();
  return raw || 'Kharif';
}

function ringColor(moisture: number): string {
  if (moisture < 30) return 'text-red-500';
  if (moisture > 65) return 'text-blue-600';
  return 'text-green-600';
}

function labelColor(moisture: number): string {
  if (moisture < 30) return 'bg-red-50 text-red-700 border-red-100';
  if (moisture > 65) return 'bg-blue-50 text-blue-700 border-blue-100';
  return 'bg-green-50 text-green-700 border-green-100';
}

function CircularGauge({ value }: { value: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;
  const color = ringColor(value);

  return (
    <div className="relative flex items-center justify-center w-24 h-24 shrink-0">
      <svg className="transform -rotate-90 w-24 h-24">
        <circle cx="48" cy="48" r={radius} stroke="currentColor" strokeWidth="10" fill="transparent" className="text-gray-100" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="currentColor"
          strokeWidth="10"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={color}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 500ms ease-in-out' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-xl font-extrabold text-gray-900">{value}%</span>
      </div>
    </div>
  );
}

export default function SoilMoistureCard({
  soilType,
  season,
  weatherCondition = 'Clear',
  recentRainfall = false,
  compact = false,
}: Props) {
  const normalizedSoil = useMemo(() => normalizeSoilType(soilType), [soilType]);
  const normalizedSeason = useMemo(() => normalizeSeason(season), [season]);

  const [reading, setReading] = useState(() =>
    generateSoilMoisture(weatherCondition, recentRainfall, normalizedSeason, normalizedSoil)
  );

  const refresh = () => {
    setReading(generateSoilMoisture(weatherCondition, recentRainfall, normalizedSeason, normalizedSoil));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weatherCondition, recentRainfall, normalizedSeason, normalizedSoil]);

  useEffect(() => {
    const id = window.setInterval(() => refresh(), 30 * 60 * 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weatherCondition, recentRainfall, normalizedSeason, normalizedSoil]);

  return (
    <div className={clsx('ds-card border border-gray-100', compact ? 'p-4' : 'p-6')}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <Droplets className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-gray-900 truncate">Soil Moisture</h3>
              <p className="text-xs text-gray-500 mt-0.5">📡 Simulated IoT Data</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={refresh}
          className="min-h-[36px] px-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-bold flex items-center gap-2 shrink-0"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className={clsx('mt-5 flex gap-5', compact ? 'items-center' : 'items-start')}>
        <CircularGauge value={reading.moisture} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx('inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold border', labelColor(reading.moisture))}>
              {reading.status}
            </span>
            <span className="text-xs text-gray-400">
              Soil: {normalizedSoil} • Season: {normalizedSeason}
            </span>
          </div>
          <p className="mt-3 text-sm text-gray-700 font-medium">{reading.recommendation}</p>

          <div className="mt-4">
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={clsx('h-2 rounded-full', ringColor(reading.moisture))}
                style={{ width: `${reading.moisture}%`, backgroundColor: 'currentColor' }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-400">
              <span>Dry &lt; 30%</span>
              <span>Optimal 30–65%</span>
              <span>Wet &gt; 65%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

