import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { UP_DISTRICTS, UP_ONLY_STATE } from '../data/upDistricts';
import { clsx } from 'clsx';

export interface LocationSelectorProps {
  selectedState: string;
  selectedDistrict: string;
  onStateChange: (state: string) => void;
  onDistrictChange: (district: string) => void;
  required?: boolean;
  disabled?: boolean;
  label?: boolean;
  className?: string;
  /** Show validation messages (parent sets after submit attempt) */
  stateError?: string;
  districtError?: string;
  /** First option = all states / all districts (Market filters) */
  allowAllOption?: boolean;
}

export default function LocationSelector({
  selectedState,
  selectedDistrict,
  onStateChange,
  onDistrictChange,
  required = false,
  disabled,
  label = true,
  className,
  stateError,
  districtError,
  allowAllOption,
}: LocationSelectorProps) {
  const { language, t } = useLanguage();
  const districts = [...UP_DISTRICTS];

  React.useEffect(() => {
    if (selectedState !== UP_ONLY_STATE) {
      onStateChange(UP_ONLY_STATE);
    }
  }, [selectedState, onStateChange]);

  return (
    <div className={clsx('space-y-3', className)}>
      <div>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1 font-devanagari">
            {language === 'hi' ? 'जिला (उत्तर प्रदेश)' : 'District (Uttar Pradesh)'}
          </label>
        )}
        <select
          value={selectedDistrict}
          disabled={disabled}
          aria-required={required}
          onChange={(e) => {
            onStateChange(UP_ONLY_STATE);
            onDistrictChange(e.target.value);
          }}
          className={clsx(
            'w-full px-4 py-2.5 rounded-xl border bg-white min-h-[44px] outline-none transition-colors',
            districtError ? 'border-red-400 focus:ring-2 focus:ring-red-200' : 'border-gray-200 focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500'
          )}
        >
          <option value="">
            {allowAllOption
              ? t('loc_all_districts')
              : language === 'hi'
                ? '-- जिला चुनें --'
                : '-- Select District --'}
          </option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        {districtError ? <p className="text-xs text-red-600 mt-1 font-devanagari">{districtError}</p> : null}
      </div>
    </div>
  );
}
