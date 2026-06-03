import { useState } from 'react';
import {
  getStoryScheduleMode,
  parseRecurrenceDays,
  toDateKey,
} from '../utils/calendar';
import StoryRecurrencePicker from './StoryRecurrencePicker';
import DateInput from './DateInput';
import TimeInput from './TimeInput';

const inputClass =
  'select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50 focus:ring-1 focus:ring-[#810100]/30';

export default function SchedulePostModal({ card, onClose, onSchedule }) {
  const isStory = card.contentType === 'Story';
  const [dueDate, setDueDate] = useState(card.dueDate || toDateKey(new Date()));
  const [dueTime, setDueTime] = useState(card.dueTime || '');
  const [storyEndDate, setStoryEndDate] = useState(card.storyEndDate || '');
  const [recurrenceMode, setRecurrenceMode] = useState(() => getStoryScheduleMode(card));
  const [recurrenceDays, setRecurrenceDays] = useState(() => parseRecurrenceDays(card.storyRecurrenceDays));
  const [error, setError] = useState('');

  const handleModeChange = (mode) => {
    setRecurrenceMode(mode);
    if (mode === 'once') {
      setRecurrenceDays([]);
      setStoryEndDate('');
    } else if (mode === 'daily') {
      setRecurrenceDays([]);
    } else if (mode === 'weekly' && !recurrenceDays.length) {
      setRecurrenceDays([1]);
      setStoryEndDate('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!dueDate) {
      setError('Pick a publish date.');
      return;
    }
    if (isStory && recurrenceMode === 'daily' && !storyEndDate) {
      setError('Pick an end date for the daily campaign.');
      return;
    }
    if (isStory && recurrenceMode === 'daily' && storyEndDate < dueDate) {
      setError('End date must be on or after the start date.');
      return;
    }
    if (isStory && recurrenceMode === 'weekly' && !recurrenceDays.length) {
      setError('Pick at least one day for weekly stories.');
      return;
    }

    onSchedule(card.id, {
      dueDate,
      dueTime,
      storyEndDate: isStory && recurrenceMode === 'daily' ? storyEndDate : '',
      storyRecurrenceDays: isStory && recurrenceMode === 'weekly' ? recurrenceDays : [],
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111111] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/5 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">
            {isStory ? 'Schedule story' : 'Schedule post'}
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            {card.client} · {card.title}
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          {isStory ? (
            <>
              <StoryRecurrencePicker
                mode={recurrenceMode}
                onModeChange={handleModeChange}
                days={recurrenceDays}
                onDaysChange={setRecurrenceDays}
                startDate={dueDate}
                onStartDateChange={setDueDate}
                endDate={storyEndDate}
                onEndDateChange={setStoryEndDate}
              />
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-400">Publish time (optional)</span>
                <TimeInput
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  placeholder="Select time"
                  inputClassName={inputClass}
                />
              </label>
            </>
          ) : (
            <>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-400">Publish date</span>
                <DateInput
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  placeholder="Select date"
                  inputClassName={inputClass}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-400">Publish time (optional)</span>
                <TimeInput
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  placeholder="Select time"
                  inputClassName={inputClass}
                />
              </label>
            </>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex gap-2 border-t border-white/5 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 rounded-lg bg-[#810100] py-2.5 text-sm font-medium text-white hover:bg-[#a00000]"
          >
            Add to calendar
          </button>
        </div>
      </form>
    </div>
  );
}
