#!/usr/bin/env tsx
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const LOCAL_DB = 'postgresql://localhost:5432/lunas';
const PROD_DB = process.env.PROD_DATABASE_URL || '';

async function main() {
  const localClient = postgres(LOCAL_DB);
  const prodClient = postgres(PROD_DB, { ssl: 'require' });

  console.log('📊 Migrating blue_book_entries...');

  const entries = await localClient`
    SELECT 
      id, builder_id, community_id, lot, model_plan_id, service_id,
      po_number, status, assignment_id, ticket_id, invoice_line_id,
      amount, check_number, check_date, check_total, is_ach,
      account_category_code, account_category_name, start_date,
      source, created_at, updated_at
    FROM blue_book_entries
  `;

  console.log(`Found ${entries.length} entries to migrate`);

  for (const entry of entries) {
    try {
      await prodClient`
        INSERT INTO blue_book_entries (
          id, builder_id, community_id, lot, model_plan_id, service_id,
          po_number, status, assignment_id, ticket_id, invoice_line_id,
          amount, check_number, check_date, check_total, is_ach,
          account_category_code, account_category_name, start_date,
          source, created_at, updated_at
        ) VALUES (
          ${entry.id}, ${entry.builder_id}, ${entry.community_id}, ${entry.lot},
          ${entry.model_plan_id}, ${entry.service_id}, ${entry.po_number},
          ${entry.status}, ${entry.assignment_id}, ${entry.ticket_id},
          ${entry.invoice_line_id}, ${entry.amount}, ${entry.check_number},
          ${entry.check_date}, ${entry.check_total}, ${entry.is_ach},
          ${entry.account_category_code}, ${entry.account_category_name},
          ${entry.start_date}, ${entry.source}, ${entry.created_at}, ${entry.updated_at}
        )
        ON CONFLICT (id) DO NOTHING
      `;
    } catch (err: any) {
      console.error(`Error migrating entry ${entry.id}:`, err.message);
    }
  }

  console.log('✅ Blue book entries migrated');

  console.log('\n📊 Migrating model_plans...');
  const plans = await localClient`SELECT * FROM model_plans`;
  console.log(`Found ${plans.length} model plans`);

  for (const plan of plans) {
    try {
      await prodClient`
        INSERT INTO model_plans (
          id, builder_id, name, code, created_at, updated_at
        ) VALUES (
          ${plan.id}, ${plan.builder_id}, ${plan.name}, ${plan.code},
          ${plan.created_at}, ${plan.updated_at}
        )
        ON CONFLICT (id) DO NOTHING
      `;
    } catch (err: any) {
      console.error(`Error migrating plan ${plan.id}:`, err.message);
    }
  }

  console.log('✅ Model plans migrated');

  await localClient.end();
  await prodClient.end();

  console.log('\n🎉 Migration complete!');
}

main().catch(console.error);
