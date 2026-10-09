import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { pushSQLiteSchema } from "drizzle-kit/api";

// Shared setup for the hub API tests in src/app/api/{updates,places,safe}.
// Each test file mocks the session and the live bus with the objects below,
// then calls freshDb() before importing a route.

type Role = "responder" | "staff" | null;

export const session = { role: null as Role };

const denied = () => Response.json({ error: "unauthorized" }, { status: 401 });
const asResponder = () => ({ role: "responder", responder_id: "r1", name: "Ana", exp: Date.now() + 1000 });
const asStaff = () => ({ role: "staff", exp: Date.now() + 1000 });

export const sessionMock = {
  requireResponder: async () => (session.role === "responder" ? asResponder() : denied()),
  requireStaff: async () => (session.role === "staff" ? asStaff() : denied()),
  requireResponderOrStaff: async () =>
    session.role === "responder" ? asResponder() : session.role === "staff" ? asStaff() : denied(),
};

/** Every event a route published, in order. */
export const published: unknown[] = [];
export const busMock = {
  publish: (event: unknown) => {
    published.push(event);
  },
};

/** Points DATABASE_PATH at a new empty file with the full schema. Call before importing @/db/client. */
export async function freshDb(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), `ulat-${prefix}-`));
  process.env.DATABASE_PATH = join(dir, "test.db");
  const sqlite = new Database(process.env.DATABASE_PATH);
  const schema = await import("@/db/schema");
  const push = await pushSQLiteSchema(schema as unknown as Record<string, unknown>, drizzle({ client: sqlite }) as never);
  sqlite.exec(push.statementsToExecute.join("\n"));
  sqlite.close();
  const { db } = await import("@/db/client");
  return { db, schema };
}

/** A request as a given role. The mocked session reads the role when the request is built. */
export function request(url: string, role: Role, init: RequestInit = {}) {
  session.role = role;
  return new Request(`http://hub${url}`, init);
}

export function postJson(url: string, role: Role, body: unknown) {
  return request(url, role, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
