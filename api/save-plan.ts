import { neon } from '@neondatabase/serverless';

// Vercel Serverless Function (Node.js version)
export default async function handler(request: any, response: any) {
  // 處理 CORS (允許跨域請求，避免瀏覽器擋住)
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 如果是 OPTIONS 請求 (預檢)，直接回傳 OK
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);

    // 1. 建立表格 (如果不存在)
    await sql`CREATE TABLE IF NOT EXISTS my_plans (
      id SERIAL PRIMARY KEY,
      data JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`;

    // 2. 讀取資料 (在 Node.js 裡，request.body 自動就是解析好的 JSON)
    const planData = request.body.plan;

    if (!planData) {
        return response.status(400).json({ error: '沒有收到 Plan 資料' });
    }

    // 3. 寫入資料庫
    await sql`INSERT INTO my_plans (data) VALUES (${JSON.stringify(planData)});`;

    return response.status(200).json({ success: true, message: 'Saved!' });

  } catch (error: any) {
    console.error("Database Error:", error);
    return response.status(500).json({ error: error.message });
  }
}