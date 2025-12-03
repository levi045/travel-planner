import { Pool } from 'pg';
import { Trip } from '../src/types';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const USER_ID = 'default-user';

interface VercelRequest {
    method?: string;
    body?: Trip[];
}

interface VercelResponse {
    status: (code: number) => VercelResponse;
    json: (data: unknown) => void;
}

export default async function handler(
    request: VercelRequest,
    response: VercelResponse
): Promise<void> {
    if (request.method === 'GET') {
        try {
            const { rows } = await pool.query<{ data: Trip[] }>(
                'SELECT data FROM itineraries WHERE user_id = $1',
                [USER_ID]
            );

            if (rows.length > 0) {
                response.status(200).json(rows[0].data);
            } else {
                response.status(200).json([]);
            }
        } catch (error) {
            console.error('Error fetching trips:', error);
            response.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
        return;
    }

    if (request.method === 'POST') {
        try {
            const tripsData = request.body as Trip[];

            await pool.query(
                `INSERT INTO itineraries (user_id, data, updated_at)
                 VALUES ($1, $2, NOW())
                 ON CONFLICT (user_id) 
                 DO UPDATE SET data = $2, updated_at = NOW()`,
                [USER_ID, JSON.stringify(tripsData)]
            );

            response.status(200).json({ success: true });
        } catch (error) {
            console.error('Error saving trips:', error);
            response.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
        return;
    }

    response.status(405).json({ error: 'Method not allowed' });
}

