import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getDriver } from '@/lib/neo4j';
import { Path, Node, Relationship } from 'neo4j-driver';

function parsePaths(records: any[]) {
  const nodesMap = new Map();
  const links: any[] = [];
  const linksSet = new Set();

  for (const record of records) {
    const path: Path = record.get('path');
    if (path && path.segments) {
      // If it's a zero-length path, just add the start node
      if (path.segments.length === 0 && path.start) {
         const start = path.start as Node;
         if (!nodesMap.has(start.elementId)) {
           nodesMap.set(start.elementId, { id: start.properties.name, label: start.labels[0], ...start.properties });
         }
      }

      path.segments.forEach(segment => {
        const start = segment.start as Node;
        const end = segment.end as Node;
        const rel = segment.relationship as Relationship;

        if (!nodesMap.has(start.elementId)) {
          nodesMap.set(start.elementId, { id: start.properties.name, label: start.labels[0], ...start.properties });
        }
        if (!nodesMap.has(end.elementId)) {
          nodesMap.set(end.elementId, { id: end.properties.name, label: end.labels[0], ...end.properties });
        }

        const linkId = rel.elementId;
        if (!linksSet.has(linkId)) {
          linksSet.add(linkId);
          links.push({
            source: start.properties.name,
            target: end.properties.name,
            type: rel.type
          });
        }
      });
    }
  }

  return { nodes: Array.from(nodesMap.values()), links };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const name = searchParams.get('name')?.trim();
  const type = searchParams.get('type');
  const mode = searchParams.get('mode') || 'blast';

  if (!name || !type) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  let driver;
  try {
    driver = getDriver();
  } catch (error) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const session = driver.session();

  try {
    let tableCypher = '';
    let graphCypher = '';
    
    if (type === 'Database') {
      if (mode === 'root') {
        // Databases have no downstream dependencies in this model
        tableCypher = `
          MATCH (n:NonExistent) 
          RETURN n.name AS service, n.tier AS tier, n.name AS team, n.name AS pager
        `;
        graphCypher = `
          MATCH path = (db:Database {name: $name})
          RETURN path
        `;
      } else {
        tableCypher = `
          MATCH (db:Database {name: $name})<-[:CONNECTS_TO]-(direct:Service)
          OPTIONAL MATCH (direct)<-[:DEPENDS_ON*1..4]-(indirect:Service)
          WITH db, collect(distinct direct) + collect(distinct indirect) AS allAffected
          UNWIND allAffected AS affected
          MATCH (team:Team)-[:OWNS]->(affected)
          RETURN DISTINCT affected.name AS service, affected.tier AS tier, team.name AS team, team.on_call_pager AS pager
          ORDER BY tier ASC, service ASC
        `;
        graphCypher = `
          MATCH path = (db:Database {name: $name})
          RETURN path
          UNION
          MATCH path = (db:Database {name: $name})<-[:CONNECTS_TO]-(:Service)
          RETURN path
          UNION
          MATCH path = (db:Database {name: $name})<-[:CONNECTS_TO]-(:Service)<-[:DEPENDS_ON*1..4]-(:Service)
          RETURN path
        `;
      }
    } else {
      if (mode === 'root') {
        tableCypher = `
          MATCH (down:Service {name: $name})-[:DEPENDS_ON*1..4]->(upstream:Service)
          MATCH (team:Team)-[:OWNS]->(upstream)
          RETURN DISTINCT upstream.name AS service, upstream.tier AS tier, team.name AS team, team.on_call_pager AS pager
          ORDER BY tier ASC, service ASC
        `;
        graphCypher = `
          MATCH path = (s:Service {name: $name})
          RETURN path
          UNION
          MATCH path = (s:Service {name: $name})-[:DEPENDS_ON*1..4]->(:Service)
          RETURN path
          UNION
          MATCH path = (s:Service {name: $name})-[:DEPENDS_ON*0..4]->(:Service)-[:CONNECTS_TO]->(:Database)
          RETURN path
        `;
      } else {
        tableCypher = `
          MATCH (down:Service {name: $name})<-[:DEPENDS_ON*1..4]-(affected:Service)
          MATCH (team:Team)-[:OWNS]->(affected)
          RETURN DISTINCT affected.name AS service, affected.tier AS tier, team.name AS team, team.on_call_pager AS pager
          ORDER BY tier ASC, service ASC
        `;
        graphCypher = `
          MATCH path = (s:Service {name: $name})
          RETURN path
          UNION
          MATCH path = (s:Service {name: $name})<-[:DEPENDS_ON*1..4]-(:Service)
          RETURN path
        `;
      }
    }

    const tableResult = await session.run(tableCypher, { name });
    const graphResult = await session.run(graphCypher, { name });

    const tableData = tableResult.records.map(record => ({
      service: record.get('service'),
      tier: record.get('tier'),
      team: record.get('team'),
      pager: record.get('pager')
    }));

    const graphData = parsePaths(graphResult.records);

    return NextResponse.json({ tableData, graphData });
  } catch (error) {
    console.error('Error calculating blast radius:', error);
    return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
  } finally {
    await session.close();
  }
}
