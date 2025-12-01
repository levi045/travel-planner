import { neon } from '@neondatabase/serverless';

export default async function handler(request: Request) {
  try {
    const sql = neon(process.env.DATABASE_URL!);

    // 抓取最新的 10 筆資料 (依時間倒序)
    const rows = await sql`SELECT * FROM my_plans ORDER BY created_at DESC LIMIT 10;`;

    return new Response(JSON.stringify({ plans: rows }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}