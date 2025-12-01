import { neon } from '@neondatabase/serverless';

export default async function handler(request: Request) {
  try {
    // 1. 連線到資料庫
    const sql = neon(process.env.DATABASE_URL!);

    // 2. 建立表格 (如果這是第一次執行，它會自動幫你建好)
    await sql`CREATE TABLE IF NOT EXISTS my_plans (
      id SERIAL PRIMARY KEY,
      data JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`;

    // 3. 抓取前端傳來的資料
    const body = await request.json();
    const planData = body.plan; // 假設前端傳來的物件叫 plan

    if (!planData) {
        throw new Error('沒有收到 Plan 資料');
    }

    // 4. 寫入資料庫
    await sql`INSERT INTO my_plans (data) VALUES (${JSON.stringify(planData)});`;

    return new Response(JSON.stringify({ success: true }), {
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