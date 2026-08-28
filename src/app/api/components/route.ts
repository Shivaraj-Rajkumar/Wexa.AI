import { NextResponse } from 'next/server';
import { getDriver } from '@/lib/neo4j';

export async function GET() {
  let driver;
  try {
    driver = getDriver();
  } catch (error) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const session = driver.session();

  try {
    const result = await session.run(`
      MATCH (n)
      WHERE n:Service OR n:Database
      RETURN labels(n)[0] as type, n.name as name
      ORDER BY type, name
    `);

    const components = result.records.map(record => ({
      type: record.get('type'),
      name: record.get('name')
    }));

    return NextResponse.json(components);
  } catch (error) {
    console.error('Error fetching components:', error);
    return NextResponse.json({ error: 'Database unreachable' }, { status: 503 });
  } finally {
    await session.close();
  }
}
