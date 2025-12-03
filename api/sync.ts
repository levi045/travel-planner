import { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

// 建立資料庫連線池
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Neon 需要 SSL 連線
  },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 設定 CORS 標頭，允許你的前端存取
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // 處理 OPTIONS 請求 (預檢請求)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { profileId } = req.query;
  
  if (!profileId || typeof profileId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid profileId' });
  }

  try {
    const client = await pool.connect();

    if (req.method === 'GET') {
      // --- 讀取功能 ---
      const result = await client.query(
        'SELECT data FROM user_trips WHERE profile_id = $1',
        [profileId]
      );
      client.release();

      if (result.rows.length > 0) {
        return res.status(200).json(result.rows[0].data);
      } else {
        return res.status(200).json([]); // 如果沒資料，回傳空陣列
      }

    } else if (req.method === 'POST') {
      // --- 儲存功能 ---
      const { data } = req.body;
      
      // 使用 UPSERT 語法：有就更新，沒有就新增
      await client.query(
        `INSERT INTO user_trips (profile_id, data, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (profile_id)
         DO UPDATE SET data = $2, updated_at = NOW()`,
        [profileId, JSON.stringify(data)]
      );
      client.release();
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}