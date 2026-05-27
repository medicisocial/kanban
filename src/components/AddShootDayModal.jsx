import { useState } from "react";
import { CONTENT_TYPES } from "../constants";
import { useClientsContext } from "../context/ClientsContext";
import { getDefaultAssigneeForRole } from "../utils/teamMembers";

const inputClass =
  "select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50 focus:ring-1 focus:ring-[#810100]/30";

export default function AddShootDayModal({
  mode = "day",
  defaultDate,
  defaultClient,
  onClose,
  onAddDay,
  onAddItem,
}) {
  const isItem = mode === "item";
  const { clients, defaultClient: firstClient, getMemberNamesForRole } = useClientsContext();
  const contentCreators = getMemberNamesForRole("Content Creator");
  const defaultCreator =
    contentCreators[0] || getDefaultAssigneeForRole("Content Creator") || "";
  const [form, setForm] = useState({
    client: defaultClient && defaultClient !== "all" ? defaultClient : firstClient,
    title: "",
    contentType: "Reel",
    shootDate: defaultDate || "",
    shootTime: "",
    contentCreator: defaultCreator,
  });
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!form.shootDate) {
      setError("Please pick a shoot date.");
      return;
    }

    if (isItem) {
      const title = form.title.trim();
      if (!title) {
        setError("Please enter a title.");
        return;
      }
      onAddItem({
        client: form.client,
        title,
        contentType: form.contentType,
        shootDate: form.shootDate,
        shootTime: form.shootTime,
        contentCreator: form.contentCreator,
      });
    } else {
      onAddDay({ client: form.client, shootDate: form.shootDate });
    }

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
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Shoot Schedule</p>
            <h2 className="text-lg font-semibold text-white">
              {isItem ? "Add shoot item" : "Add client shoot"}
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

          {isItem && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Title</span>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Product hero reel"
                className={inputClass}
                autoFocus
              />
            </label>
          )}

          <div className={`grid grid-cols-1 gap-4 ${isItem ? "sm:grid-cols-2" : ""}`}>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Client</span>
              <select
                value={form.client}
                onChange={(e) => setForm({ ...form, client: e.target.value })}
                className={inputClass}
                autoFocus={!isItem}
              >
                {clients.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            {isItem && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-400">Type</span>
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
              </label>
            )}
          </div>

          <div className={`grid grid-cols-1 gap-4 ${isItem ? "sm:grid-cols-2" : ""}`}>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Shoot date</span>
              <input
                type="date"
                value={form.shootDate}
                onChange={(e) => setForm({ ...form, shootDate: e.target.value })}
                className={inputClass}
              />
            </label>

            {isItem && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-400">Shoot time (optional)</span>
                <input
                  type="time"
                  value={form.shootTime}
                  onChange={(e) => setForm({ ...form, shootTime: e.target.value })}
                  className={inputClass}
                />
              </label>
            )}
          </div>

          {isItem && contentCreators.length > 0 && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Content creator</span>
              <select
                value={form.contentCreator}
                onChange={(e) => setForm({ ...form, contentCreator: e.target.value })}
                className={inputClass}
              >
                {contentCreators.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!isItem && (
            <p className="text-xs text-gray-500">
              Creates an empty client shoot so you can fill in session details and add
              content later.
            </p>
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
            className="flex-1 rounded-lg bg-[#810100] py-2.5 text-sm font-medium text-white hover:bg-[#a00000]"
          >
            {isItem ? "Add item" : "Add client shoot"}
          </button>
        </div>
      </form>
    </div>
  );
}
