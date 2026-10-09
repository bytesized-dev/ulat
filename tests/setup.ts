import { config } from "dotenv";

// Tests see the same .env.local the app does, such as MOCK_AI.
config({ path: ".env.local", quiet: true });
