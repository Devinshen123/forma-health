import { ChevronLeft, ChevronRight } from 'lucide-react';
import { recordingToday, shiftRecordingDay } from '../features/recordingDates';
import type { Language } from '../types';

export function RecordingDatePicker({ value, onChange, label, lang, timezone }: {
  value: string; onChange: (day: string) => void; label: string; lang: Language; timezone?: string;
}) {
  const zh = lang === 'zh';
  return <div className="recording-date-picker">
    <button className="icon-button" aria-label={zh ? '前一天' : 'Previous day'} onClick={() => onChange(shiftRecordingDay(value, -1))}><ChevronLeft size={18} /></button>
    <label className="field"><span className="muted">{label}</span>
      <input className="input" type="date" required value={value} onChange={event => { if (event.target.value) onChange(event.target.value); }} />
    </label>
    <button className="icon-button" aria-label={zh ? '后一天' : 'Next day'} onClick={() => onChange(shiftRecordingDay(value, 1))}><ChevronRight size={18} /></button>
    <button className="btn btn-secondary" onClick={() => onChange(recordingToday(timezone))}>{zh ? '今天' : 'Today'}</button>
  </div>;
}
