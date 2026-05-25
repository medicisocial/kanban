import { useState } from "react";
import { splitList, joinList } from "../utils/shootDay";

export default function ModelTagInput({
  value = "",
  onChange,
  disabled = false,
  placeholder = "Type a name and press Enter",
  id,
}) {
  const models = splitList(value);
  const [draft, setDraft] = useState("");

  const commitDraft = () => {
    const trimmed = draft.trim().replace(/,+$/, "");
    if (!trimmed) return;

    const next = [...models];
    for (const part of splitList(trimmed)) {
      if (!next.some((name) => name.toLowerCase() === part.toLowerCase())) {
        next.push(part);
      }
    }
    onChange(joinList(next));
    setDraft("");
  };

  const removeAt = (index) => {
    onChange(joinList(models.filter((_, i) => i !== index)));
  };

  return (
    <div
      className={`flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-[#1a1a1a] px-2 py-1.5 ${
        disabled ? "opacity-60" : ""
      }`}
    >
      {models.map((name, index) => (
        <span
          key={`${name}-${index}`}
          className="inline-flex items-center gap-1 rounded-full bg-[#810100]/20 px-2 py-0.5 text-xs font-medium text-[#fecaca]"
        >
          {name}
          {!disabled && (
            <button
              type="button"
              onClick={() => removeAt(index)}
              className="rounded-full px-0.5 text-[#fca5a5] transition hover:bg-[#810100]/30 hover:text-white"
              aria-label={`Remove ${name}`}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          id={id}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commitDraft();
            }
            if (e.key === "Backspace" && !draft && models.length) {
              removeAt(models.length - 1);
            }
          }}
          onBlur={commitDraft}
          placeholder={models.length ? "Add another…" : placeholder}
          className="min-w-[120px] flex-1 bg-transparent px-1 py-0.5 text-sm text-[#f9f6f2] outline-none placeholder:text-gray-600"
        />
      )}
    </div>
  );
}
