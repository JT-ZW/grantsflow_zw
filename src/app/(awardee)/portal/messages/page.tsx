import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { markReadByAwardee, awardeeSendMessage } from "./actions";

type Message = {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
  profiles: { full_name: string | null; role: string } | null;
  read_by_admin_at: string | null;
  read_by_awardee_at: string | null;
};

export default async function PortalMessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: awardeeData } = await supabase
    .from("awardees")
    .select("id, full_name, grants(id, title)")
    .eq("user_id", user.id)
    .single();

  const awardee = awardeeData as unknown as {
    id: string;
    full_name: string;
    grants: { id: string; title: string }[];
  } | null;

  const grant = awardee?.grants?.[0];
  if (!grant) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
        No grant linked to your account yet.
      </div>
    );
  }

  await markReadByAwardee(grant.id);

  const { data: msgs } = await supabase
    .from("messages")
    .select("id, body, created_at, sender_id, read_by_admin_at, read_by_awardee_at, profiles(full_name, role)")
    .eq("grant_id", grant.id)
    .order("created_at", { ascending: true });

  const messages = (msgs ?? []) as unknown as Message[];

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Messages</h1>
        <p className="text-xs text-gray-500 mt-0.5">{grant.title}</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
          {messages.length === 0 && (
            <p className="text-sm text-gray-400 italic text-center py-8">
              No messages yet. Send the first one below.
            </p>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_id === user.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    isMe
                      ? "bg-[#6b1a2a] text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                  <div className={`mt-1 flex items-center gap-2 text-[10px] ${isMe ? "text-red-200 justify-end" : "text-gray-400"}`}>
                    <span>{msg.profiles?.full_name ?? (isMe ? "You" : "Admin")}</span>
                    <span>·</span>
                    <span>{new Date(msg.created_at).toLocaleString("en-ZA")}</span>
                    {isMe && msg.read_by_admin_at && <span>· ✓ Read</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <form action={awardeeSendMessage} className="border-t border-gray-100 p-4 flex gap-2">
          <input type="hidden" name="grant_id" value={grant.id} />
          <textarea
            name="body"
            required
            rows={2}
            placeholder="Type a message…"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a] resize-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-[#6b1a2a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5a1522] self-end transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
