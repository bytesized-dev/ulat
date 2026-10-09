import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-auth flex-col justify-center gap-4 px-gutter py-12">
      <h1 className="text-title-md font-medium">There is nothing here</h1>
      <p className="text-body-md text-body">The address may be mistyped, or the page moved.</p>
      <Button asChild variant="outline" className="self-start">
        <Link href="/">Go to the start</Link>
      </Button>
    </main>
  );
}
