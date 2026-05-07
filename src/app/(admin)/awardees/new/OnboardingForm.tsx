"use client";

import { useActionState, useState } from "react";
import { createAwardeeAndGrant, type OnboardingState } from "../actions";
import { cn } from "@/lib/utils";

const initialState: OnboardingState = {};

const GRANT_TYPES = [
  "Research Grant",
  "Innovation & Entrepreneurship",
  "Conference & Travel",
  "Equipment & Infrastructure",
  "Postgraduate Bursary",
  "Community Engagement",
  "Other",
];

const CURRENCIES = ["ZAR", "USD", "EUR", "GBP"];

type Milestone = { title: string; due_date: string; deliverables: string };

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 text-xs text-red-600">{errors[0]}</p>;
}

function Label({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function Input({
  id, name, type = "text", placeholder, required, defaultValue, className,
}: {
  id: string; name: string; type?: string; placeholder?: string;
  required?: boolean; defaultValue?: string; className?: string;
}) {
  return (
    <input
      id={id} name={name} type={type} placeholder={placeholder}
      required={required} defaultValue={defaultValue}
      className={cn(
        "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
        className
      )}
    />
  );
}

export default function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createAwardeeAndGrant, initialState);
  const [milestones, setMilestones] = useState<Milestone[]>([
    { title: "", due_date: "", deliverables: "" },
  ]);

  function addMilestone() {
    if (milestones.length < 8) {
      setMilestones([...milestones, { title: "", due_date: "", deliverables: "" }]);
    }
  }

  function removeMilestone(i: number) {
    setMilestones(milestones.filter((_, idx) => idx !== i));
  }

  function updateMilestone(i: number, field: keyof Milestone, value: string) {
    const updated = milestones.map((m, idx) =>
      idx === i ? { ...m, [field]: value } : m
    );
    setMilestones(updated);
  }

  const sectionClass = "rounded-xl border border-gray-200 bg-white p-6 space-y-4";
  const sectionTitle = "text-base font-semibold text-gray-900 mb-4";

  return (
    <form action={formAction} className="space-y-6">
      {/* Hidden milestones JSON */}
      <input
        type="hidden"
        name="milestones_json"
        value={JSON.stringify(milestones)}
      />

      {state.message && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      {/* ── AWARDEE DETAILS ───────────────────────────────── */}
      <div className={sectionClass}>
        <h2 className={sectionTitle}>Awardee Details</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="full_name" required>Full name</Label>
            <Input id="full_name" name="full_name" placeholder="Dr. Jane Dlamini" required />
            <FieldError errors={state.errors?.full_name} />
          </div>
          <div>
            <Label htmlFor="email" required>Email address</Label>
            <Input id="email" name="email" type="email" placeholder="jane@university.ac.za" required />
            <FieldError errors={state.errors?.email} />
          </div>
          <div>
            <Label htmlFor="phone">Phone number</Label>
            <Input id="phone" name="phone" type="tel" placeholder="+27 71 000 0000" />
          </div>
          <div>
            <Label htmlFor="awardee_type" required>Awardee type</Label>
            <select
              id="awardee_type"
              name="awardee_type"
              defaultValue="individual"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="individual">Individual</option>
              <option value="team">Team</option>
              <option value="organization">Organization</option>
            </select>
          </div>
          <div>
            <Label htmlFor="student_number">Student / Staff number</Label>
            <Input id="student_number" name="student_number" placeholder="e.g. 12345678" />
          </div>
          <div>
            <Label htmlFor="faculty">Faculty</Label>
            <Input id="faculty" name="faculty" placeholder="e.g. Engineering & the Built Environment" />
          </div>
          <div>
            <Label htmlFor="department">Department</Label>
            <Input id="department" name="department" placeholder="e.g. Computer Science" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-gray-100">
          <div>
            <Label htmlFor="supervisor_name">Supervisor / Line manager</Label>
            <Input id="supervisor_name" name="supervisor_name" placeholder="Prof. John Mokoena" />
          </div>
          <div>
            <Label htmlFor="supervisor_email">Supervisor email</Label>
            <Input id="supervisor_email" name="supervisor_email" type="email" placeholder="mokoena@university.ac.za" />
            <FieldError errors={state.errors?.supervisor_email} />
          </div>
        </div>
      </div>

      {/* ── GRANT DETAILS ────────────────────────────────── */}
      <div className={sectionClass}>
        <h2 className={sectionTitle}>Grant Details</h2>

        <div>
          <Label htmlFor="grant_title" required>Grant title</Label>
          <Input id="grant_title" name="grant_title" placeholder="e.g. AI-Assisted Crop Disease Detection" required />
          <FieldError errors={state.errors?.grant_title} />
        </div>

        <div>
          <Label htmlFor="grant_description">Description</Label>
          <textarea
            id="grant_description"
            name="grant_description"
            rows={3}
            placeholder="Brief description of the project or research..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="grant_type" required>Grant type</Label>
            <select
              id="grant_type"
              name="grant_type"
              defaultValue=""
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="" disabled>Select type…</option>
              {GRANT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <FieldError errors={state.errors?.grant_type} />
          </div>

          <div>
            <Label htmlFor="amount_awarded" required>Amount awarded</Label>
            <div className="flex gap-2">
              <select
                name="currency_code"
                defaultValue="ZAR"
                className="rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <Input
                id="amount_awarded"
                name="amount_awarded"
                type="number"
                placeholder="50000"
                required
                className="flex-1"
              />
            </div>
            <FieldError errors={state.errors?.amount_awarded} />
          </div>

          <div>
            <Label htmlFor="start_date" required>Start date</Label>
            <Input id="start_date" name="start_date" type="date" required />
            <FieldError errors={state.errors?.start_date} />
          </div>

          <div>
            <Label htmlFor="end_date" required>End date</Label>
            <Input id="end_date" name="end_date" type="date" required />
            <FieldError errors={state.errors?.end_date} />
          </div>
        </div>
      </div>

      {/* ── MILESTONES ──────────────────────────────────── */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={cn(sectionTitle, "mb-0")}>Milestones</h2>
          <button
            type="button"
            onClick={addMilestone}
            disabled={milestones.length >= 8}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-40"
          >
            + Add milestone
          </button>
        </div>

        <div className="space-y-4">
          {milestones.map((m, i) => (
            <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Milestone {i + 1}
                </span>
                {milestones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMilestone(i)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`ms_title_${i}`}>Title</Label>
                  <input
                    id={`ms_title_${i}`}
                    value={m.title}
                    onChange={(e) => updateMilestone(i, "title", e.target.value)}
                    placeholder="e.g. Literature review completed"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <Label htmlFor={`ms_date_${i}`}>Due date</Label>
                  <input
                    id={`ms_date_${i}`}
                    type="date"
                    value={m.due_date}
                    onChange={(e) => updateMilestone(i, "due_date", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor={`ms_del_${i}`}>Deliverables</Label>
                  <input
                    id={`ms_del_${i}`}
                    value={m.deliverables}
                    onChange={(e) => updateMilestone(i, "deliverables", e.target.value)}
                    placeholder="e.g. Submitted 20-page review document"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SUBMIT ──────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3">
        <a
          href="/awardees"
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {pending ? "Saving…" : "Create Awardee & Grant"}
        </button>
      </div>
    </form>
  );
}
