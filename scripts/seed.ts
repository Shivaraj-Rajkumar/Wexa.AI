import { getDriver, closeDriver } from '../src/lib/neo4j';
import * as dotenv from 'dotenv';

// Load environment variables for the standalone script
dotenv.config({ path: '.env.local' });

const seedData = `
// Clear existing data (for idempotency during development)
MATCH (n) DETACH DELETE n;

// Create Teams
CREATE (t_frontend:Team {name: "Frontend Platform", on_call_pager: "pager.me/frontend"})
CREATE (t_checkout:Team {name: "Checkout Experience", on_call_pager: "pager.me/checkout"})
CREATE (t_auth:Team {name: "Identity & Access", on_call_pager: "pager.me/auth"})
CREATE (t_inventory:Team {name: "Inventory Management", on_call_pager: "pager.me/inventory"})
CREATE (t_data:Team {name: "Data Platform", on_call_pager: "pager.me/data"})

// Create Services
CREATE (s_web:Service {name: "web-client", language: "TypeScript", tier: 1})
CREATE (s_mobile:Service {name: "mobile-api-gateway", language: "Go", tier: 1})
CREATE (s_checkout:Service {name: "checkout-service", language: "Java", tier: 1})
CREATE (s_auth:Service {name: "auth-service", language: "Go", tier: 1})
CREATE (s_inventory:Service {name: "inventory-service", language: "Python", tier: 2})
CREATE (s_payment:Service {name: "payment-gateway", language: "Java", tier: 1})
CREATE (s_recommendation:Service {name: "recommendation-engine", language: "Python", tier: 3})

// Create Databases
CREATE (db_users:Database {name: "users-db", type: "PostgreSQL"})
CREATE (db_orders:Database {name: "orders-db", type: "PostgreSQL"})
CREATE (db_inventory:Database {name: "inventory-cache", type: "Redis"})
CREATE (db_products:Database {name: "products-db", type: "MongoDB"})

// Setup Ownership
CREATE (t_frontend)-[:OWNS]->(s_web)
CREATE (t_frontend)-[:OWNS]->(s_mobile)
CREATE (t_checkout)-[:OWNS]->(s_checkout)
CREATE (t_checkout)-[:OWNS]->(s_payment)
CREATE (t_auth)-[:OWNS]->(s_auth)
CREATE (t_auth)-[:OWNS]->(db_users)
CREATE (t_inventory)-[:OWNS]->(s_inventory)
CREATE (t_inventory)-[:OWNS]->(db_inventory)
CREATE (t_data)-[:OWNS]->(s_recommendation)
CREATE (t_data)-[:OWNS]->(db_products)
CREATE (t_checkout)-[:OWNS]->(db_orders)

// Setup Service Dependencies
CREATE (s_web)-[:DEPENDS_ON {is_critical: true}]->(s_checkout)
CREATE (s_web)-[:DEPENDS_ON {is_critical: true}]->(s_auth)
CREATE (s_web)-[:DEPENDS_ON {is_critical: false}]->(s_recommendation)

CREATE (s_mobile)-[:DEPENDS_ON {is_critical: true}]->(s_checkout)
CREATE (s_mobile)-[:DEPENDS_ON {is_critical: true}]->(s_auth)

CREATE (s_checkout)-[:DEPENDS_ON {is_critical: true}]->(s_auth)
CREATE (s_checkout)-[:DEPENDS_ON {is_critical: true}]->(s_inventory)
CREATE (s_checkout)-[:DEPENDS_ON {is_critical: true}]->(s_payment)

CREATE (s_recommendation)-[:DEPENDS_ON {is_critical: true}]->(s_inventory)

// Setup Database Connections
CREATE (s_auth)-[:CONNECTS_TO {is_critical: true}]->(db_users)
CREATE (s_checkout)-[:CONNECTS_TO {is_critical: true}]->(db_orders)
CREATE (s_inventory)-[:CONNECTS_TO {is_critical: true}]->(db_inventory)
CREATE (s_inventory)-[:CONNECTS_TO {is_critical: true}]->(db_products)
CREATE (s_recommendation)-[:CONNECTS_TO {is_critical: true}]->(db_products)
`;

async function runSeed() {
  console.log('Connecting to CognoDB...');
  
  let driver;
  try {
    driver = getDriver();
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
  
  // Verify connection
  try {
    const serverInfo = await driver.getServerInfo();
    console.log('Connection established:', serverInfo.address);
  } catch (error) {
    console.error('Failed to connect to the database. Check your credentials in .env.local');
    console.error(error);
    process.exit(1);
  }

  const session = driver.session();

  try {
    console.log('Running seed queries...');
    const queries = seedData.split(';').map(q => q.trim()).filter(q => q.length > 0);
    for (const query of queries) {
       await session.run(query);
    }
    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await session.close();
    await closeDriver();
  }
}

runSeed();
