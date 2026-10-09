import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { QueueView } from "@/components/responder/queue-view";
import { TabBar } from "@/components/ui/tab-bar";
import { readActiveResponder, SESSION_COOKIE } from "@/lib/auth/session";
import { routes } from "@/lib/contracts";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const token = (await cookies()).get(SESSION_COOKIE.responder)?.value;
  if (!(await readActiveResponder(token))) redirect(routes.responder.signIn);

  // The queue itself lives in the phone's IndexedDB, so the page has nothing to read here.
  return (
    <div className="flex min-h-dvh flex-col">
      <QueueView />
      <div className="sticky bottom-0 bg-canvas">
        <TabBar active="queue" />
      </div>
    </div>
  );
}
