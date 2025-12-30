'use client';

import { useRef, useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { DayPicker, DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import 'react-day-picker/style.css';
import { TIME_PERIODS, TIMEZONE_OPTIONS } from '../types';

interface DateRangeSelectorProps {
  selectedPeriodId: string;
  timezone: string;
  dateRange: DateRange | undefined;
  showCustomDatePicker: boolean;
  onPeriodChange: (periodId: string) => void;
  onTimezoneChange: (timezone: string) => void;
  onDateRangeSelect: (range: DateRange | undefined) => void;
  onApplyCustomRange: () => void;
  onCancelCustomRange: () => void;
  onShowCustomDatePicker: (show: boolean) => void;
}

export function DateRangeSelector({
  selectedPeriodId,
  timezone,
  dateRange,
  showCustomDatePicker,
  onPeriodChange,
  onTimezoneChange,
  onDateRangeSelect,
  onApplyCustomRange,
  onCancelCustomRange,
  onShowCustomDatePicker,
}: DateRangeSelectorProps) {
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        onShowCustomDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onShowCustomDatePicker]);

  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200">
      <div className="flex flex-wrap items-center gap-4">
        {/* Time Period Label and Timezone */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[#4B7BF5]" />
            <span className="text-sm font-medium text-slate-700">Time Period</span>
          </div>
          <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-500">Timezone:</span>
            <select
              value={timezone}
              onChange={(e) => onTimezoneChange(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-[#4B7BF5] focus:border-transparent outline-none bg-white"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Period Buttons */}
        <div className="relative flex flex-wrap items-center gap-2 ml-auto" ref={datePickerRef}>
          {TIME_PERIODS.map((period) => (
            <button
              key={period.id}
              onClick={() => onPeriodChange(period.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                selectedPeriodId === period.id
                  ? 'bg-[#4B7BF5] text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {period.label}
            </button>
          ))}

          {/* Calendar Date Range Picker */}
          {showCustomDatePicker && (
            <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50">
              <div className="mb-2 pb-2 border-b border-slate-100">
                <h4 className="text-xs font-semibold text-slate-800">Select Date Range</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Click start date, then end date
                </p>
              </div>
              <style>{`
                .custom-calendar .rdp {
                  --rdp-accent-color: #4B7BF5;
                  --rdp-background-color: #e8effd;
                  --rdp-accent-background-color: #4B7BF5;
                  --rdp-day_button-border-radius: 6px;
                  --rdp-day_button-width: 32px;
                  --rdp-day_button-height: 32px;
                  margin: 0;
                  font-size: 13px;
                }
                .custom-calendar .rdp-months {
                  gap: 16px;
                }
                .custom-calendar .rdp-month {
                  margin: 0;
                }
                .custom-calendar .rdp-month_caption {
                  font-weight: 600;
                  font-size: 13px;
                  color: #334155;
                  padding: 0 0 8px 0;
                }
                .custom-calendar .rdp-nav {
                  gap: 4px;
                }
                .custom-calendar .rdp-button_previous, 
                .custom-calendar .rdp-button_next {
                  width: 28px;
                  height: 28px;
                }
                .custom-calendar .rdp-chevron {
                  width: 16px;
                  height: 16px;
                  fill: #4B7BF5;
                }
                .custom-calendar .rdp-weekday {
                  color: #64748b;
                  font-weight: 500;
                  font-size: 11px;
                  width: 32px;
                  height: 28px;
                }
                .custom-calendar .rdp-day_button {
                  font-size: 12px;
                }
                .custom-calendar .rdp-day_button:hover:not([disabled]) {
                  background-color: #e8effd;
                }
                .custom-calendar .rdp-selected .rdp-day_button {
                  background-color: #4B7BF5;
                  color: white;
                }
                .custom-calendar .rdp-range_middle .rdp-day_button {
                  background-color: #e8effd;
                  color: #4B7BF5;
                }
                .custom-calendar .rdp-today .rdp-day_button {
                  font-weight: bold;
                  border: 2px solid #4B7BF5;
                }
                .custom-calendar .rdp-outside .rdp-day_button {
                  color: #cbd5e1;
                }
                .custom-calendar .rdp-disabled .rdp-day_button {
                  color: #e2e8f0;
                }
              `}</style>
              <div className="custom-calendar">
                <DayPicker
                  mode="range"
                  selected={dateRange}
                  onSelect={onDateRangeSelect}
                  numberOfMonths={1}
                  disabled={{ after: new Date() }}
                  showOutsideDays
                />
              </div>
              {dateRange?.from && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <div className="text-xs text-slate-600 mb-2">
                    {dateRange.to ? (
                      <span>
                        <span className="font-medium">
                          {format(dateRange.from, 'MMM d, yyyy')}
                        </span>
                        {' → '}
                        <span className="font-medium">
                          {format(dateRange.to, 'MMM d, yyyy')}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[#4B7BF5]">
                        {format(dateRange.from, 'MMM d, yyyy')} → Select end date
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div className="mt-2 pt-2 border-t border-slate-100 flex justify-end gap-2">
                <button
                  onClick={onCancelCustomRange}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onApplyCustomRange}
                  disabled={!dateRange?.from || !dateRange?.to}
                  className="px-4 py-1.5 text-xs font-medium bg-[#4B7BF5] text-white rounded-lg hover:bg-[#3d6ae0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
