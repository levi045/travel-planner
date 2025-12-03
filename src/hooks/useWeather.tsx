import { useState, useEffect } from 'react';
import { Sun, CloudSun, CloudFog, CloudRain, Snowflake, CloudLightning } from 'lucide-react';

export interface WeatherData {
    icon: React.ReactNode;
    text: string;
    tempRange: string;
}

export const useWeather = (
    lat: number,
    lng: number,
    dateStr: string,
    dayOffset: number
): { weather: WeatherData | null; loading: boolean; autoLocationName: string } => {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(false);
    const [autoLocationName, setAutoLocationName] = useState<string>("");

    useEffect(() => {
        const fetchWeather = async () => {
            if (!lat || !lng || lat === 0) return;

            setLoading(true);
            try {
                const targetDate = new Date(dateStr);
                targetDate.setDate(targetDate.getDate() + dayOffset);
                const targetDateIso = targetDate.toISOString().split('T')[0];
                const today = new Date();
                const diffTime = targetDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                const isForecastAvailable = diffDays >= -2 && diffDays <= 14;
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto${isForecastAvailable ? `&start_date=${targetDateIso}&end_date=${targetDateIso}` : ''}`;

                const res = await fetch(url);
                const data = await res.json();

                if (data.daily?.weathercode?.length > 0) {
                    const code = data.daily.weathercode[0];
                    const min = Math.round(data.daily.temperature_2m_min[0]);
                    const max = Math.round(data.daily.temperature_2m_max[0]);
                    let text = "晴朗";
                    let icon = <Sun size={24} className="text-orange-400" />;

                    if (code > 0) {
                        if (code <= 3) {
                            text = "多雲";
                            icon = <CloudSun size={24} className="text-yellow-500" />;
                        } else if (code <= 48) {
                            text = "霧";
                            icon = <CloudFog size={24} className="text-gray-400" />;
                        } else if (code <= 67) {
                            text = "雨";
                            icon = <CloudRain size={24} className="text-blue-400" />;
                        } else if (code <= 77) {
                            text = "雪";
                            icon = <Snowflake size={24} className="text-blue-200" />;
                        } else if (code >= 95) {
                            text = "雷雨";
                            icon = <CloudLightning size={24} className="text-purple-500" />;
                        } else {
                            text = "陰";
                            icon = <CloudSun size={24} className="text-gray-500" />;
                        }
                    }

                    setWeather({ icon, text, tempRange: `${min}° - ${max}°` });
                } else {
                    setWeather({ icon: <CloudSun size={24} />, text: "暫無", tempRange: "--" });
                }
            } catch (e) {
                setWeather(null);
            } finally {
                setLoading(false);
            }
        };

        fetchWeather();
    }, [lat, lng, dateStr, dayOffset]);

    useEffect(() => {
        if (!lat || !lng || lat === 0) return;
        if (!window.google?.maps?.Geocoder) return;

        const geocoder = new google.maps.Geocoder();
        geocoder.geocode(
            { location: { lat, lng }, language: 'zh-TW' },
            (results, status) => {
                if (status === 'OK' && results?.[0]) {
                    const components = results[0].address_components;
                    const city = components.find(c => c.types.includes('locality'))?.long_name;
                    const prefecture = components.find(c => c.types.includes('administrative_area_level_1'))?.long_name;
                    setAutoLocationName(city || prefecture || "未知區域");
                }
            }
        );
    }, [lat, lng]);

    return { weather, loading, autoLocationName };
};

