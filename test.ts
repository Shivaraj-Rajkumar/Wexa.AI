import { getDriver } from './src/lib/neo4j';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const driver = getDriver();
  const session = driver.session();
  try {
    const res = await session.run('MATCH (s:Service) RETURN count(s) as c');
    const tableCypher = `
        MATCH (down:Service {name: $name})<-[:DEPENDS_ON*1..4]-(affected:Service)
        MATCH (team:Team)-[:OWNS]->(affected)
        RETURN affected.name AS service, affected.tier AS tier, team.name AS team, team.on_call_pager AS pager
        ORDER BY tier ASC, service ASC
    `;
    const res2 = await session.run(tableCypher, { name: 'inventory-service' });
    console.log('Results:', res2.records.length);
    console.log('Data:', res2.records.map(r => r.get('service')));
  } finally {
    await session.close();
    await driver.close();
  }
}
run();
