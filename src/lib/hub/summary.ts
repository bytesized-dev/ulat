import { sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { entries, reports, settings } from "../../db/schema";
import { HubSummary, Need, type BarangayRow } from "../contracts/schemas";

// docs/SPEC.md section 6. The code counts, never the model: every number here
// comes from one SQL query over confirmed entries, or over reports for the
// "not yet visited" and "waiting" counts. Family reports never move the damage
// totals. Callers pass the database so tests can use their own file.

/** Report statuses that mean nobody has visited the house yet. */
const OPEN = sql`('waiting', 'assigned', 'on_the_way')`;

/** One SQL expression for the priority rule, so the ranking is computed by the database. */
export const PRIORITY_SQL = sql`
  case
    when hurt + missing >= 2 then 'high'
    when hurt + missing >= 1 or totally >= 2 then 'medium'
    else 'low'
  end`;

type Totals = Omit<HubSummary, "as_of" | "needs" | "barangays" | "not_yet_visited" | "in_review">;

function totals(db: Db): Totals {
  return db.get<Totals>(sql`
    select
      count(*) as houses_checked,
      coalesce(sum(${entries.damage_class} = 'total'), 0) as totally,
      coalesce(sum(${entries.damage_class} = 'partial'), 0) as partially,
      coalesce(sum(${entries.damage_class} = 'none'), 0) as none,
      coalesce(sum(${entries.families}), 0) as families,
      coalesce(sum(${entries.people}), 0) as people,
      coalesce(sum(${entries.hurt}), 0) as hurt,
      coalesce(sum(${entries.missing}), 0) as missing
    from ${entries}
    where ${entries.status} = 'confirmed'`);
}

function counts(db: Db): { not_yet_visited: number; in_review: number } {
  return db.get(sql`
    select
      (select count(*) from ${reports} where ${reports.status} in ${OPEN}) as not_yet_visited,
      (select count(*) from ${entries} where ${entries.status} = 'needs_review') as in_review`);
}

/** Households in confirmed entries that list each need. Every need is present, zero when nobody listed it. */
function needs(db: Db): HubSummary["needs"] {
  const rows = db.all<{ need: string; households: number }>(sql`
    select need.value as need, count(distinct ${entries.id}) as households
    from ${entries}, json_each(${entries.needs}) as need
    where ${entries.status} = 'confirmed'
    group by need.value`);
  const found = new Map(rows.map((r) => [r.need, r.households]));
  return Object.fromEntries(Need.options.map((n) => [n, found.get(n) ?? 0])) as HubSummary["needs"];
}

/**
 * One row per barangay: every barangay in settings, plus any that only appear
 * in entries or open reports. Sorted by hurt plus missing, then totally
 * damaged, then reports waiting, then name so ties keep a stable order.
 */
function barangays(db: Db): BarangayRow[] {
  return db.all<BarangayRow>(sql`
    with
      listed as (
        select b.value as barangay
        from ${settings}, json_each(case when json_valid(${settings.value}) then ${settings.value} else '[]' end) as b
        where ${settings.key} = 'barangays'
      ),
      damage as (
        select
          ${entries.barangay} as barangay,
          sum(${entries.damage_class} = 'total') as totally,
          sum(${entries.damage_class} = 'partial') as partially,
          sum(${entries.damage_class} = 'none') as none,
          sum(${entries.families}) as families,
          sum(${entries.people}) as people,
          sum(${entries.hurt}) as hurt,
          sum(${entries.missing}) as missing
        from ${entries}
        where ${entries.status} = 'confirmed'
        group by ${entries.barangay}
      ),
      open_reports as (
        select ${reports.barangay} as barangay, count(*) as waiting
        from ${reports}
        where ${reports.status} in ${OPEN}
        group by ${reports.barangay}
      ),
      names as (
        select barangay from listed
        union select barangay from damage
        union select barangay from open_reports
      ),
      rows as (
        select
          names.barangay,
          coalesce(d.totally, 0) as totally,
          coalesce(d.partially, 0) as partially,
          coalesce(d.none, 0) as none,
          coalesce(d.families, 0) as families,
          coalesce(d.people, 0) as people,
          coalesce(d.hurt, 0) as hurt,
          coalesce(d.missing, 0) as missing,
          coalesce(o.waiting, 0) as waiting
        from names
        left join damage d on d.barangay = names.barangay
        left join open_reports o on o.barangay = names.barangay
      )
    select *, ${PRIORITY_SQL} as priority
    from rows
    order by hurt + missing desc, totally desc, waiting desc, barangay asc`);
}

/** Totals, per barangay rows, priority and needs for the hub. Parsed with the contract before it leaves. */
export function getHubSummary(db: Db, asOf: Date = new Date()): HubSummary {
  return HubSummary.parse({
    as_of: asOf.toISOString(),
    ...totals(db),
    ...counts(db),
    needs: needs(db),
    barangays: barangays(db),
  });
}
