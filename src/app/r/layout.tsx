import { QueueSync } from "@/components/responder/queue-sync";

// Every responder page, so a queued entry goes out from wherever the responder is.
export default function ResponderLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <QueueSync />
    </>
  );
}
