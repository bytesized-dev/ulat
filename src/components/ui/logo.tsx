import Image from "next/image";
import { cn } from "@/lib/utils";

// The Ulat logo: the house mark over the wordmark. The file is served from
// public/brand, so it loads from the hub with no internet. The navy art is
// made for light backgrounds, so on a dark surface wrap it in a light plate.
function Logo({ className, priority }: { className?: string; priority?: boolean }) {
  return <Image data-slot="logo" src="/brand/ulat-logo.png" alt="Ulat" width={519} height={640} priority={priority} className={cn("h-auto w-20", className)} />;
}

export { Logo };
