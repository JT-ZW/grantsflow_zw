"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { saveMilestoneAdminNote } from "./actions";

// ── Types ────────────────────────────────────────────────────────────────────

type MilestoneUpdate = {
  id: string;
  note: string | null;
  status_at: string;
  completion_pct: number | null;
  planned_next: string | null;
  blockers: string | null;
  created_at: string;
};

type Milestone = {
  id: string;
  title: string;
  description: string | null;
  deliverables: string | null;
  due_date: string;
  status: string;
  sort_order: number;
  progress_notes: string | null;
  completion_pct: number | null;
  admin_notes: string | null;
  admin_flag: string | null;
  milestone_updates: MilestoneUpdate[];
};

type Props = {
  milestones: Milestone[];
  awardeeId: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_NODE_STYLE: Record<string, string> = {
  not_started: "bg-gray-100 border-gray-300 text-gray-500",
  in_progress:  "bg-blue-500  border-blue-600  text-white",
  completed:    "bg-green-500 border-green-600 text-white",
  delayed:      "bg-red-500   border-red-600   text-white",
};

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress:  "In progress",
  completed:    "Completed",
  delayed:      "Delayed",
};

const FLAG_STYLE: Record<string, string> = {
  on_track:        "bg-green-100  text-green-800  border-green-200",
  needs_attention: "bg-yellow-100 text-yellow-800 border-yellow-200",
  at_risk:         "bg-red-100    text-red-800    border-red-200",
};

const FLAG_LABEL: Record<string, string> = {
  on_track:        "On track",
  needs_attention: "Needs attention",
  at_risk:         "At risk",
};

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

function isOverdue(m: Milestone) {
  return (
    m.status !== "completed" && new Date(m.due_date) < new Date()
  );
}

// ── Detail panel with admin note form ────────────────────────────────────────

function MilestoneDetailPanel({
  milestone,
  awardeeId,
}: {
  milestone: Milestone;
  awardeeId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [adminNotes, setAdminNotes] = useState(milestone.admin_notes ?? "");
  const [adminFlag, setAdminFlag] = useState(milestone.admin_flag ?? "");
  const [historyOpen, setHistoryOpen] = useState(false);

  const latest =
    milestone.milestone_updates.length > 0
      ? milestone.milestone_updates[0]
      : null;
  const older = milestone.milestone_updates.slice(1);

  function handleSave() {
    const fd = new FormData();
    fd.set("milestone_id", milestone.id);
    fd.set("awardee_id", awardeeId);
    fd.set("admin_notes", adminNotes);
    fd.set("admin_flag", adminFlag);
    startTransition(async () => {
      await saveMilestoneAdminNote(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  const overdue = isOverdue(milestone);

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {milestone.title}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                FLAG_STYLE[milestone.status] ?? "bg-gray-100 text-gray-600 border-gray-200"
              }`}
            >
              {STATUS_LABEL[milestone.status] ?? milestone.status}
            </span>
            {overdue && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                Overdue
              </span>
            )}
            {milestone.admin_flag && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                  FLAG_STYLE[milestone.admin_flag]
                }`}
              >
                {FLAG_LABEL[milestone.admin_flag]}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            Due {fmt(milestone.due_date)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
        {/* Left: awardee progress */}
        <div className="px-5 py-4 space-y-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Awardee progress
          </h4>

          {milestone.deliverables && (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-0.5">
                Deliverables
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {milestone.deliverables}
              </p>
            </div>
          )}

          {/* Completion bar */}
          {(milestone.completion_pct !== null) && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Completion</span>
                <span className="font-semibold">{milestone.completion_pct}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    milestone.completion_pct >= 100
                      ? "bg-green-500"
                      : milestone.completion_pct >= 60
                      ? "bg-blue-500"
                      : "bg-amber-400"
                  }`}
                  style={{ width: `${milestone.completion_pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Latest update */}
          {latest ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Latest update — {fmt(latest.created_at)}
              </p>

              {latest.note && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-0.5">
                    Achieved
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {latest.note}
                  </p>
                </div>
              )}

              {latest.planned_next && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-0.5">
                    Planned next
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {latest.planned_next}
                  </p>
                </div>
              )}

              {latest.blockers && (
                <div>
                  <p className="text-xs font-medium text-amber-600 mb-0.5">
                    Blockers
                  </p>
                  <p className="text-sm text-amber-800 whitespace-pre-wrap">
                    {latest.blockers}
                  </p>
                </div>
              )}

              {/* Older updates toggle */}
              {older.length > 0 && (
                <div>
                  <button
                    onClick={() => setHistoryOpen(!historyOpen)}
                    className="text-xs text-[#6b1a2a] hover:underline"
                  >
                    {historyOpen ? "Hide" : "Show"} {older.length} older{" "}
                    {older.length === 1 ? "update" : "updates"}
                  </button>

                  {historyOpen && (
                    <div className="mt-3 space-y-3 border-l-2 border-gray-100 pl-3">
                      {older.map((u) => (
                        <div key={u.id} className="space-y-1">
                          <p className="text-xs text-gray-400">
                            {fmt(u.created_at)}
                            {u.completion_pct !== null && (
                              <span className="ml-2 font-medium text-gray-600">
                                {u.completion_pct}%
                              </span>
                            )}
                          </p>
                          {u.note && (
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">
                              {u.note}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">
              No updates submitted yet.
            </p>
          )}
        </div>

        {/* Right: admin annotation */}
        <div className="px-5 py-4 space-y-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Admin notes
          </h4>

          {/* Flag select */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Status flag
            </label>
            <select
              value={adminFlag}
              onChange={(e) => setAdminFlag(e.target.value)}
              suppressHydrationWarning
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]/30 focus:border-[#6b1a2a]"
            >
              <option value="">No flag</option>
              <option value="on_track">On track</option>
              <option value="needs_attention">Needs attention</option>
              <option value="at_risk">At risk</option>
            </select>
          </div>

          {/* Notes textarea */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Admin notes
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={4}
              suppressHydrationWarning
              placeholder="Add internal observations, recommendations, or follow-ups…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]/30 focus:border-[#6b1a2a] resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-[#6b1a2a] text-white text-sm font-medium hover:bg-[#5a1622] disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving…" : "Save notes"}
            </button>
            {saved && (
              <span className="text-sm text-green-600 font-medium">
                ✓ Saved
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main timeline component ───────────────────────────────────────────────────

export function MilestoneTimeline({ milestones, awardeeId }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    milestones[0]?.id ?? null
  );

  const selected = milestones.find((m) => m.id === selectedId) ?? null;

  if (milestones.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic py-4">
        No milestones defined for this grant yet.
      </p>
    );
  }

  const nodeCount = milestones.length;

  return (
    <div className="space-y-2">
      {/* Timeline row */}
      <div className="overflow-x-auto pb-3">
        <div
          className="relative px-6"
          style={{ minWidth: `${Math.max(nodeCount * 130, 440)}px` }}
        >
          {/* Connecting line */}
          <div
            className="absolute top-5 left-14 right-14 h-0.5 bg-gray-200"
            aria-hidden="true"
          />

          {/* Nodes */}
          <div className="relative flex justify-between">
            {milestones.map((m) => {
              const isSelected = m.id === selectedId;
              const overdue = isOverdue(m);

              return (
                <button
                  key={m.id}
                  onClick={() =>
                    setSelectedId((prev) => (prev === m.id ? null : m.id))
                  }
                  title={m.title}
                  className="flex flex-col items-center gap-1.5 w-28 group focus:outline-none"
                >
                  {/* Circle */}
                  <div
                    className={[
                      "relative w-10 h-10 rounded-full border-2 flex items-center justify-center",
                      "text-sm font-bold z-10 transition-all duration-150",
                      STATUS_NODE_STYLE[m.status] ?? "bg-gray-100 border-gray-300",
                      isSelected
                        ? "ring-4 ring-[#6b1a2a]/30 scale-110"
                        : "group-hover:scale-105 group-hover:shadow-md",
                    ].join(" ")}
                  >
                    {m.status === "completed"
                      ? "✓"
                      : m.status === "delayed"
                      ? "!"
                      : m.sort_order + 1}
                  </div>

                  {/* Title */}
                  <span
                    className={`text-xs font-medium text-center leading-tight w-24 line-clamp-2 transition-colors ${
                      isSelected ? "text-[#6b1a2a]" : "text-gray-700 group-hover:text-gray-900"
                    }`}
                  >
                    {m.title}
                  </span>

                  {/* Due date */}
                  <span
                    className={`text-[10px] font-medium ${
                      overdue ? "text-red-500" : "text-gray-400"
                    }`}
                  >
                    {fmtShort(m.due_date)}
                  </span>

                  {/* Admin flag dot */}
                  {m.admin_flag && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium border ${
                        FLAG_STYLE[m.admin_flag]
                      }`}
                    >
                      {FLAG_LABEL[m.admin_flag]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-1 text-xs text-gray-500">
        {[
          { key: "not_started", cls: "bg-gray-200",  label: "Not started" },
          { key: "in_progress",  cls: "bg-blue-500",  label: "In progress" },
          { key: "completed",    cls: "bg-green-500", label: "Completed" },
          { key: "delayed",      cls: "bg-red-500",   label: "Delayed" },
        ].map(({ key, cls, label }) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${cls}`} />
            {label}
          </span>
        ))}
        <span className="text-gray-400">· Click a node to expand</span>
      </div>

      {/* Detail panel */}
      {selected && (
        <MilestoneDetailPanel
          key={selected.id}
          milestone={selected}
          awardeeId={awardeeId}
        />
      )}
    </div>
  );
}
