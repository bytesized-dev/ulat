import type { Metadata } from "next";
import { LockForm } from "@/components/hub/lock-form";
import { safeNext } from "@/lib/hub/lock";

export const metadata: Metadata = { title: "Hub locked" };

type LockPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function HubLockPage({ searchParams }: LockPageProps) {
  const { next } = await searchParams;
  return <LockForm next={safeNext(next)} />;
}
