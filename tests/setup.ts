import { config } from "dotenv";

// Tests see the same .env.local the app does, such as MOCK_AI.
config({ path: ".env.local", quiet: true });

// Tests that run scripts/seed.ts get the times as written in seed/simulation.json,
// not times shifted to the wall clock, so their dates do not move between runs.
process.env.SEED_FIXED_TIMES = "1";
