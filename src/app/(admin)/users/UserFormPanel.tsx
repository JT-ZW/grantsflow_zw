"use client";

import { useState } from "react";
import { InviteUserForm } from "./InviteUserForm";
import { CreateUserForm } from "./CreateUserForm";

export function UserFormPanel() {
  const [tab, setTab] = useState<"invite" | "create">("invite");

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTab("invite")}
          className={`flex-1 px-5 py-3 text-sm font-medium transition-colors ${
            tab === "invite"
              ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
          }`}
        >
          Send invitation
        </button>
        <button
          type="button"
          onClick={() => setTab("create")}
          className={`flex-1 px-5 py-3 text-sm font-medium transition-colors ${
            tab === "create"
              ? "bg-green-50 text-green-700 border-b-2 border-green-600"
              : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
          }`}
        >
          Create with password
        </button>
      </div>

      {tab === "invite" ? <InviteUserForm embedded /> : <CreateUserForm />}
    </div>
  );
}
