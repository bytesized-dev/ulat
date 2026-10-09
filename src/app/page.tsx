import { product } from "@/config";

// Placeholder until the family home lands in its own issue.

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-prose flex-col justify-center gap-3 px-gutter py-12">
      <h1 className="text-title-page font-medium">{product.name}</h1>
      <p className="text-body-md text-body">{product.oneLine}</p>
    </main>
  );
}
