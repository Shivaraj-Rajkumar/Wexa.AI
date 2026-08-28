import neo4j, { Driver } from 'neo4j-driver';

// Next.js hot reloading in dev can create multiple driver instances, 
// so we attach the singleton to the global object.
const globalNeo4j = global as unknown as { driver: Driver };

export function getDriver(): Driver {
  const uri = process.env.NEO4J_URI;
  const username = process.env.NEO4J_USERNAME || 'cognodb';
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !password) {
    throw new Error('NEO4J_URI and NEO4J_PASSWORD environment variables are missing. Please check your .env.local file.');
  }

  if (!globalNeo4j.driver) {
    globalNeo4j.driver = neo4j.driver(
      uri,
      neo4j.auth.basic(username, password),
      { disableLosslessIntegers: true } // Converts Neo4j integers to native JS numbers automatically
    );
  }

  return globalNeo4j.driver;
}

export async function closeDriver() {
  if (globalNeo4j.driver) {
    await globalNeo4j.driver.close();
    globalNeo4j.driver = undefined as any;
  }
}
