import React from 'react';

const inputClass =
  'select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50 focus:ring-1 focus:ring-[#810100]/30';

export default function ScriptPanel({
  hook = '',
  body = '',
  overlays = '',
  onChange = () => {},
  readOnly = false,
}) {
  if (readOnly) {
    return (
      <div className="space-y-4">
        {hook?.trim() && (
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">Hook</h4>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#f9f6f2]">{hook}</p>
          </section>
        )}
        {body?.trim() && (
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">Body</h4>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#f9f6f2]">{body}</p>
          </section>
        )}
        {overlays?.trim() && (
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">Text overlays</h4>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#f9f6f2]">{overlays}</p>
          </section>
        )}
        {!hook?.trim() && !body?.trim() && !overlays?.trim() && (
          <p className="text-sm text-gray-500">No script written yet.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-gray-400">Hook</span>
        <textarea
          value={hook}
          onChange={(e) => onChange({ hook: e.target.value })}
          rows={3}
          placeholder="First 1–3 seconds — opening line / hook"
          className={`${inputClass} resize-y`}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-gray-400">Body</span>
        <textarea
          value={body}
          onChange={(e) => onChange({ body: e.target.value })}
          rows={6}
          placeholder="Main beats, dialogue, B-roll notes"
          className={`${inputClass} resize-y`}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-gray-400">Text overlays</span>
        <textarea
          value={overlays}
          onChange={(e) => onChange({ overlays: e.target.value })}
          rows={4}
          placeholder="On-screen copy, line by line"
          className={`${inputClass} resize-y`}
        />
      </label>
    </div>
  );
}

