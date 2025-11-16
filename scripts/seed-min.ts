import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { getPgDrizzle } from './db-client'

async function firstEnumLabelForColumn(
  db: any,
  schema: string,
  table: string,
  column: string,
): Promise<string | undefined> {
  const q = sql`
    SELECT e.enumlabel
    FROM pg_attribute a
    JOIN pg_class c      ON a.attrelid  = c.oid
    JOIN pg_namespace n  ON c.relnamespace = n.oid
    JOIN pg_type t       ON a.atttypid  = t.oid
    JOIN pg_enum e       ON t.oid       = e.enumtypid
    WHERE n.nspname = ${schema}
      AND c.relname = ${table}
      AND a.attname = ${column}
    ORDER BY e.enumsortorder
    LIMIT 1;
  `
  const res: any = await db.execute(q)
  return res?.rows?.[0]?.enumlabel
}

const slug = (x: string) =>
  x.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

async function upsertReturningId(db: any, selectSql: any, insertSql: any) {
  const ins: any = await db.execute(insertSql)
  if (ins?.rows?.[0]?.id) return ins.rows[0].id
  const sel: any = await db.execute(selectSql)
  return sel?.rows?.[0]?.id
}

async function main() {
  const schema = 'public'
  const { db, client } = await getPgDrizzle()
  try {
    const orgName = 'Lunas'
    const orgSlug = slug(orgName)
    const orgId = await upsertReturningId(
      db,
      sql`SELECT id FROM ${sql.identifier(schema)}.${sql.identifier('orgs')} WHERE slug = ${orgSlug}`,
      sql`
        INSERT INTO ${sql.identifier(schema)}.${sql.identifier('orgs')}
          ("name","slug")
        VALUES (${orgName}, ${orgSlug})
        ON CONFLICT DO NOTHING
        RETURNING id
      `
    )

    const builderName = 'Default Builder'
    const builderId = await upsertReturningId(
      db,
      sql`SELECT id FROM ${sql.identifier(schema)}.${sql.identifier('builders')} WHERE name = ${builderName}`,
      sql`
        INSERT INTO ${sql.identifier(schema)}.${sql.identifier('builders')}
          ("name")
        VALUES (${builderName})
        ON CONFLICT DO NOTHING
        RETURNING id
      `
    )

    const communityName = 'Sunset Hills'
    const communityId = await upsertReturningId(
      db,
      sql`SELECT id FROM ${sql.identifier(schema)}.${sql.identifier('communities')} WHERE name = ${communityName} AND builder_id = ${builderId}`,
      sql`
        INSERT INTO ${sql.identifier(schema)}.${sql.identifier('communities')}
          ("builder_id","name","city","state","active")
        VALUES (${builderId}, ${communityName}, 'Las Vegas', 'NV', true)
        ON CONFLICT DO NOTHING
        RETURNING id
      `
    )

    const modelCode = 'M-100'
    const modelName = 'Plan 100'
    const modelId = await upsertReturningId(
      db,
      sql`SELECT id FROM ${sql.identifier(schema)}.${sql.identifier('model_plans')} WHERE code = ${modelCode} AND builder_id = ${builderId}`,
      sql`
        INSERT INTO ${sql.identifier(schema)}.${sql.identifier('model_plans')}
          ("builder_id","code","name","sqft","defaults")
        VALUES (${builderId}, ${modelCode}, ${modelName}, 1800, '{}'::jsonb)
        ON CONFLICT DO NOTHING
        RETURNING id
      `
    )

    const unitKind =
      (await firstEnumLabelForColumn(db, schema, 'services', 'unit_kind')) ??
      'each'

    const svcCode = 'CLEAN'
    const svcName = 'Construction Cleanup'
    const serviceId = await upsertReturningId(
      db,
      sql`SELECT id FROM ${sql.identifier(schema)}.${sql.identifier('services')} WHERE code = ${svcCode}`,
      sql`
        INSERT INTO ${sql.identifier(schema)}.${sql.identifier('services')}
          ("code","name","category","unit_kind")
        VALUES (${svcCode}, ${svcName}, 'cleanup', ${sql.raw(`'${unitKind}'::text`)})
        ON CONFLICT DO NOTHING
        RETURNING id
      `
    )

    const statusLabel =
      (await firstEnumLabelForColumn(db, schema, 'blue_book_entries', 'status')) ??
      'new'

    await db.execute(sql`
      INSERT INTO ${sql.identifier(schema)}.${sql.identifier('blue_book_entries')}
        ("builder_id","community_id","lot","model_plan_id","service_id",
         "po_number","status","amount","check_date","check_total","is_ach","start_date")
      VALUES (
        ${builderId}, ${communityId}, '001', ${modelId}, ${serviceId},
        'PO-1', ${sql.raw(`'${statusLabel}'`)}, 250, CURRENT_DATE, 0, false, CURRENT_DATE
      )
      ON CONFLICT DO NOTHING
    `)

    console.log('[seed-min] ✅ inserted minimal demo data.')
  } finally {
    await (client as any)?.end?.({ timeout: 5 })
  }
}

main().catch((e) => {
  console.error('[seed-min] ❌', e)
  process.exit(1)
})
