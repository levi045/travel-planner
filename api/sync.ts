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

  let client;
  try {
    client = await pool.connect();

    if (req.method === 'GET') {
      // --- 讀取功能 ---
      const result = await client.query(
        'SELECT data FROM user_trips WHERE profile_id = $1',
        [profileId]
      );

      if (result.rows.length > 0) {
        let data = result.rows[0].data;
        
        // 如果 data 是字串，需要解析 JSON（適用於 TEXT 欄位）
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch (parseError) {
            console.error('Failed to parse stored data:', parseError);
            return res.status(500).json({ error: 'Invalid data format in database' });
          }
        }
        
        // 確保回傳的是陣列格式
        if (!Array.isArray(data)) {
          console.warn('Data is not an array, returning empty array');
          return res.status(200).json([]);
        }
        
        return res.status(200).json(data);
      } else {
        return res.status(200).json([]); // 如果沒資料，回傳空陣列
      }

    } else if (req.method === 'POST') {
      // --- 儲存功能 ---
      const { data } = req.body;
      
      // 驗證資料格式
      if (!data) {
        return res.status(400).json({ error: 'Missing data in request body' });
      }
      
      if (!Array.isArray(data)) {
        return res.status(400).json({ error: 'Data must be an array' });
      }
      
      // 將資料轉換為 JSON 字串
      const dataToStore = JSON.stringify(data);
      
      // 使用 UPSERT 語法：有就更新，沒有就新增
      // 嘗試使用 JSONB 格式（如果欄位是 JSONB 類型）
      // 如果欄位是 TEXT 類型，PostgreSQL 會自動將 JSON 字串儲存為文字
      try {
        await client.query(
          `INSERT INTO user_trips (profile_id, data, updated_at)
           VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT (profile_id)
           DO UPDATE SET data = $2::jsonb, updated_at = NOW()`,
          [profileId, dataToStore]
        );
      } catch (jsonbError: any) {
        // 如果 JSONB 轉換失敗（可能是欄位是 TEXT 類型），嘗試不使用轉換
        if (jsonbError.message?.includes('jsonb') || jsonbError.message?.includes('type')) {
          await client.query(
            `INSERT INTO user_trips (profile_id, data, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (profile_id)
             DO UPDATE SET data = $2, updated_at = NOW()`,
            [profileId, dataToStore]
          );
        } else {
          throw jsonbError;
        }
      }
      
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Database Error:', error);
    
    // 提供更詳細的錯誤訊息
    const errorMessage = error.message || 'Unknown error';
    const isConnectionError = errorMessage.includes('connect') || errorMessage.includes('timeout');
    
    res.status(500).json({ 
      error: 'Internal Server Error', 
      details: isConnectionError ? 'Database connection failed' : errorMessage,
      type: isConnectionError ? 'connection' : 'database'
    });
  } finally {
    // 確保連線一定會被釋放
    if (client) {
      client.release();
    }
  }
}