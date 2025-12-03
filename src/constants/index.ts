import type { FlightInfo, Trip } from '../types';

export const DEFAULT_CATEGORIES = [
    '觀光景點', '美食餐廳', '購物行程', '咖啡廳',
    '神社/寺廟', '博物館/美術館', '公園/自然',
    '居酒屋/酒吧', '甜點/下午茶', '伴手禮',
    '藥妝店', '飯店/住宿', '交通/車站',
    '主題樂園', '便利商店', '休息點'
] as const;

export const INITIAL_TRIP_ID = 'trip-default';
export const STORAGE_KEY = 'travel-planner-storage-v31';
export const SYNC_STATUS_TIMEOUT = 3000;
export const JPY_TO_TWD_RATE = 0.2;
export const DEFAULT_MAP_CENTER = { lat: 35.6762, lng: 139.6503 };
export const DEFAULT_ZOOM = 13;

export const DEFAULT_FLIGHT: FlightInfo = {
    flightNo: '',
    depTime: '',
    arrTime: '',
    depAirport: '',
    arrAirport: ''
};

export const INITIAL_TRIPS: Trip[] = [
    {
        id: INITIAL_TRIP_ID,
        name: '我的東京冒險',
        destination: '日本東京',
        startDate: new Date().toISOString().split('T')[0],
        outbound: { ...DEFAULT_FLIGHT },
        inbound: { ...DEFAULT_FLIGHT },
        currentDayIndex: 0,
        days: [
            {
                id: 'day-1',
                spots: [
                    {
                        id: '1',
                        name: '淺草寺 (雷門)',
                        category: '神社/寺廟',
                        startTime: '10:00',
                        endTime: '12:00',
                        location: { lat: 35.7147, lng: 139.7967 },
                        website: 'https://www.senso-ji.jp/',
                        rating: 4.7
                    },
                    {
                        id: '2',
                        name: '晴空塔敘敘苑',
                        category: '美食餐廳',
                        startTime: '14:00',
                        endTime: '16:00',
                        location: { lat: 35.7100, lng: 139.8107 },
                        note: '記得要訂位，靠窗位置風景最好！',
                        rating: 4.5
                    }
                ]
            }
        ]
    }
];

