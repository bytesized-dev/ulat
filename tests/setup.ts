import { config } from "dotenv";

// Tests see the same .env.local the app does, such as OLLAMA_URL.
config({ path: ".env.local", quiet: true });
