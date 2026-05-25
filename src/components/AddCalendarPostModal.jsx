import { useState } from "react";
import { CONTENT_TYPES } from "../constants";
import { useClientsContext } from "../context/ClientsContext";
import { toDateKey } from "../utils/calendar";
import StoryRecurrencePicker from "./StoryRecurrencePicker";

const inputClass =
  "select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50 focus:ring-1 focus:ring-[#810100]/30";

export default function AddCalendarPostModal({
  defaultDate,
  defaultClient,
  defaultContentType = "Reel",
  lockContentType = false,
  onClose,
  onAdd,
}) {
  const { clients, defaultClient: firstClient } = useClientsContext();
  const [form, setForm] = useState({
    client: defaultClient && defaultClient !== "all" ? defaultClient : firstClient,
    title: "",
    contentType: defaultContentType,
    dueDate: defaultDate || "",
    dueTime: "",
  });
  const [recurrenceMode, setRecurrenceMode] = useState("once");
  const [recurrenceDays, setRecurrenceDays] = useState([]);
  const [storyEndDate, setStoryEndDate] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    const title = form.title.trim();
    if (!title) {
      setError("Please enter a title.");
      return;
    }

    const isWeeklyStory = lockContentType && recurrenceMode === "weekly";
    const isDailyStory = lockContentType && recurrenceMode === "daily";

    if (isWeeklyStory) {
      if (!recurrenceDays.length) {
        setError("Pick at least one day for the story to repeat.");
        return;
      }
    } else if (isDailyStory) {
      if (!form.dueDate || !storyEndDate) {
        setError("Pick a start and end date for the daily campaign.");
        return;
      }
      if (storyEndDate < form.dueDate) {
        setError("End date must be on or after the start date.");
        return;
      }
    } else if (!form.dueDate) {
      setError("Please pick a publish date.");
      return;
    }

    onAdd({
      client: form.client,
      title,
      contentType: form.contentType,
      dueDate: isWeeklyStory ? form.dueDate || toDateKey(new Date()) : form.dueDate,
      dueTime: form.dueTime,
      storyRecurrenceDays: isWeeklyStory ? recurrenceDays : [],
      storyEndDate: isDailyStory ? storyEndDate : "",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Calendar</p>
            <h2 className="text-lg font-semibold text-white">
              {lockContentType ? "Add story" : "Add post"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-gray-400">Title</span>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={lockContentType ? "e.g. Weekly poll story" : "e.g. Summer sale reel"}
              className={inputClass}
              autoFocus
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Client</span>
              <select
                value={form.client}
                onChange={(e) => setForm({ ...form, client: e.target.value })}
                className={inputClass}
              >
                {clients.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Type</span>
              {lockContentType ? (
                <input type="text" value="Story" disabled className={`${inputClass} opacity-70`} />
              ) : (
                <select
                  value={form.contentType}
                  onChange={(e) => setForm({ ...form, contentType: e.target.value })}
                  className={inputClass}
                >
                  {CONTENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>

          {lockContentType && (
            <StoryRecurrencePicker
              mode={recurrenceMode}
              onModeChange={setRecurrenceMode}
              days={recurrenceDays}
              onDaysChange={setRecurrenceDays}
              startDate={form.dueDate}
              onStartDateChange={(dueDate) => setForm({ ...form, dueDate })}
              endDate={storyEndDate}
              onEndDateChange={setStoryEndDate}
            />
          )}

          {(!lockContentType || recurrenceMode === "once") && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-400">Publish date</span>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-400">Publish time (optional)</span>
                <input
                  type="time"
                  value={form.dueTime}
                  onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
                  className={inputClass}
                />
              </label>
            </div>
          )}

          {lockContentType && (recurrenceMode === "weekly" || recurrenceMode === "daily") && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Publish time (optional)</span>
              <input
                type="time"
                value={form.dueTime}
                onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
                className={inputClass}
              />
              <p className="mt-1 text-[10px] text-gray-500">Same time each selected day</p>
            </label>
          )}
        </div>

        <div className="flex gap-2 border-t border-white/5 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-white/10 py-2.5 text-sm text-gray-300 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium text-white ${
              lockContentType ? "bg-blue-600 hover:bg-blue-500" : "bg-[#810100] hover:bg-[#a00000]"
            }`}
          >
            Add to {lockContentType ? "stories calendar" : "calendar"}
          </button>
        </div>
      </form>
    </div>
  );
}
