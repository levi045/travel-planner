import { neon } from '@neondatabase/serverless';

export default async function handler(request: any, response: any) {
  // 處理 CORS
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);
    
    // 讀取最新的 1 筆資料
    const rows = await sql`SELECT * FROM my_plans ORDER BY created_at DESC LIMIT 1;`;

    return response.status(200).json({ plans: rows });
  } catch (error: any) {
    console.error("Database Error:", error);
    return response.status(500).json({ error: error.message });
  }
}