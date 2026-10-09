import { loadSeed } from "./seed-load";

loadSeed().catch((error) => {
  console.error(error);
  process.exit(1);
});
