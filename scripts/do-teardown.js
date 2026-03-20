const DO_TOKEN = process.env.DO_TOKEN || "";

async function main() {
  console.log("Fetching DigitalOcean Apps...");
  const appsRes = await fetch("https://api.digitalocean.com/v2/apps", {
    headers: { Authorization: `Bearer ${DO_TOKEN}` }
  });
  const apps = await appsRes.json();
  for (const app of apps.apps || []) {
    console.log(`Deleting App: ${app.spec.name} (${app.id})`);
    await fetch(`https://api.digitalocean.com/v2/apps/${app.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${DO_TOKEN}` }
    });
  }

  console.log("Fetching DigitalOcean Databases...");
  const dbRes = await fetch("https://api.digitalocean.com/v2/databases", {
    headers: { Authorization: `Bearer ${DO_TOKEN}` }
  });
  const dbs = await dbRes.json();
  for (const db of dbs.databases || []) {
    console.log(`Deleting Database: ${db.name} (${db.id})`);
    await fetch(`https://api.digitalocean.com/v2/databases/${db.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${DO_TOKEN}` }
    });
  }
  console.log("Teardown complete.");
}
main().catch(console.error);
