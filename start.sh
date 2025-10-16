#!/bin/bash
set -e

echo "🚀 Starting LUNAS-OS..."
echo ""

# Start database
echo "📦 Starting PostgreSQL database..."
docker-compose up -d
echo "✅ Database started"
echo ""

# Wait for database to be ready
echo "⏳ Waiting for database..."
sleep 3

# Check if tables exist
TABLE_COUNT=$(docker-compose exec -T db psql -U user -d lunas-os -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | tr -d ' ')

if [ "$TABLE_COUNT" = "0" ] || [ -z "$TABLE_COUNT" ]; then
    echo "📋 Database is empty, setting up..."
    
    # Apply migrations manually
    echo "  → Applying migrations..."
    for f in db/migrations/*.sql; do
        docker-compose exec -T db psql -U user -d lunas-os < "$f" > /dev/null 2>&1
    done
    
    # Add seed data
    echo "  → Adding seed data..."
    docker-compose exec -T db psql -U user -d lunas-os << 'SQL'
INSERT INTO services (code, name, unit_kind) VALUES 
  ('ROUGH', 'Rough Clean', 'PER_JOB'),
  ('FINAL', 'Final Clean', 'PER_JOB'),
  ('QA', 'QA Clean', 'PER_JOB'),
  ('PAINT_SWEEP', 'Paint Sweep', 'PER_SQFT'),
  ('FRAME_SWEEP', 'Frame Sweep', 'PER_SQFT'),
  ('POWER_WASH', 'Power Wash', 'PER_JOB'),
  ('TUBS_WINDOWS', 'Tubs & Windows', 'PER_UNIT')
ON CONFLICT DO NOTHING;

INSERT INTO builders (name) VALUES ('Pulte'), ('Lennar'), ('KB Home')
ON CONFLICT DO NOTHING;

INSERT INTO users (email, name, role, password_hash) VALUES 
  ('admin@lunas.com', 'Admin', 'ADMIN', '$2b$10$JdVLHeKJdCMZ7YzPcZf4v.GKI2MqKhWKJxf5WhBa1PQ7gm8nF6Udy'),
  ('dispatcher@lunas.com', 'Dispatcher', 'DISPATCHER', '$2b$10$JdVLHeKJdCMZ7YzPcZf4v.GKI2MqKhWKJxf5WhBa1PQ7gm8nF6Udy')
ON CONFLICT DO NOTHING;
SQL
    echo "✅ Database setup complete"
else
    echo "✅ Database already set up ($TABLE_COUNT tables found)"
fi
echo ""

# Start Next.js server
echo "🌐 Starting Next.js server on port 4010..."
echo "   → http://localhost:4010"
echo ""
PORT=4010 pnpm next dev --turbo -p 4010
