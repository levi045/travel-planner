import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { GoogleMap, Marker, Polyline, useJsApiLoader, InfoWindow } from '@react-google-maps/api';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Map as MapIcon, MapPin, Plus, Trash2, Loader2, X, Menu, Languages, Calendar as CalendarIcon, Wallet, List, CheckCircle2, CloudUpload, Lock } from 'lucide-react';

// Store & Types
import { useStore } from './store/useItineraryStore';
import type { SelectedLocation } from './types';

// Components
import { TripSidebar } from './components/trip/TripSidebar';
import { MapHeader } from './components/map/MapHeader';
import { DayTabs } from './components/itinerary/DayTabs';
import { DayHeader } from './components/itinerary/DayHeader';
import { SpotCard } from './components/itinerary/SpotCard';
import { FlightCard } from './components/itinerary/FlightCard';
import { TranslateView } from './components/views/TranslateView';
import { BudgetView } from './components/views/BudgetView';
import { ResizeHandle } from './components/layout/ResizeHandle';

// Hooks & Utils
import { useResize } from './hooks/useResize';
import { formatDate } from './utils/date';
import { calculateMapCenter } from './utils/map';
import { DEFAULT_ZOOM } from './constants';

// Constants
const LIBRARIES: ("places")[] = ["places"];
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

export default function VacationPlanner() {
    const {
        trips,
        activeTripId,
        savedCategories,
        setCurrentDayIndex,
        addDay,
        deleteDay,
        addSpot,
        addEmptySpot,
        removeSpot,
        reorderSpots,
        updateSpot,
        addCategory,
        removeCategory,
        updateFlight,
        reorderDays,
        updateDayInfo,
        syncStatus,
        fetchTripsFromCloud,
        saveTripsToCloud
    } = useStore();

    const activeTrip = useMemo(
        () => trips.find(t => t.id === activeTripId) || trips[0],
        [trips, activeTripId]
    );

    const { days, currentDayIndex, startDate, name: tripName, outbound, inbound, destination, isLocked } = activeTrip;

    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const mapRef = useRef<google.maps.Map | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
    const [pickingLocationForSpotId, setPickingLocationForSpotId] = useState<string | null>(null);
    const [editingSpotLocationId, setEditingSpotLocationId] = useState<string | null>(null);
    const [searchCandidates, setSearchCandidates] = useState<google.maps.places.PlaceResult[]>([]);
    const [mobileView, setMobileView] = useState<'map' | 'list'>('list');
    const [rightPanelMode, setRightPanelMode] = useState<'itinerary' | 'translate' | 'budget'>('itinerary');

    const { leftWidth, setLeftWidth, startResizing } = useResize(60);

    // Initialize and auto-save
    useEffect(() => {
        fetchTripsFromCloud();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (trips.length > 0) {
                saveTripsToCloud();
            }
        }, 2000);
        return () => clearTimeout(timer);
    }, [trips]);

    const { isLoaded, loadError } = useJsApiLoader({
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        libraries: LIBRARIES,
        language: 'zh-TW'
    });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const onLoadMap = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
    }, []);

    const onUnmountMap = useCallback(() => {
        mapRef.current = null;
    }, []);

    const currentDayData = useMemo(
        () => days[currentDayIndex] || { spots: [] },
        [days, currentDayIndex]
    );

    const currentSpots = currentDayData.spots;
    const validSpots = useMemo(
        () => currentSpots.filter(s => s.location.lat !== 0 && s.location.lng !== 0),
        [currentSpots]
    );

    const mapCenter = useMemo(
        () => calculateMapCenter(validSpots),
        [validSpots]
    );

    const polylinePath = useMemo(
        () => validSpots.map(s => s.location),
        [validSpots]
    );

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        if (isLocked) return;
        const { active, over } = event;
        if (active.id !== over?.id) {
            reorderSpots(active.id as string, over?.id as string);
        }
    }, [isLocked, reorderSpots]);

    const handleDayDragEnd = useCallback((event: DragEndEvent) => {
        if (isLocked) return;
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = days.findIndex(d => d.id === active.id);
            const newIndex = days.findIndex(d => d.id === over?.id);
            reorderDays(oldIndex, newIndex);
            setCurrentDayIndex(newIndex);
        }
    }, [isLocked, days, reorderDays, setCurrentDayIndex]);

    const handleAutoLocate = useCallback(async (spotId: string, name: string) => {
        if (!mapRef.current || !name) return;
        const service = new google.maps.places.PlacesService(mapRef.current);

        setEditingSpotLocationId(spotId);
        setMobileView('map');
        setRightPanelMode('itinerary');

        return new Promise<void>((resolve) => {
            service.findPlaceFromQuery(
                {
                    query: name,
                    fields: ['name', 'geometry', 'formatted_address', 'place_id', 'rating', 'website']
                },
                (results, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && results?.[0]?.geometry?.location) {
                        const place = results[0];
                        setSelectedLocation({
                            lat: place.geometry!.location!.lat(),
                            lng: place.geometry!.location!.lng(),
                            name: place.name || name,
                            address: place.formatted_address || '',
                            rating: place.rating,
                            website: place.website
                        });
                        mapRef.current?.panTo(place.geometry!.location!);
                        mapRef.current?.setZoom(15);
                    } else {
                        alert("找不到地點，請試著手動定位！💦");
                        setEditingSpotLocationId(null);
                    }
                    resolve();
                }
            );
        });
    }, []);

    const handleTextSearch = useCallback((query: string) => {
        if (!mapRef.current || !query) return;
        const service = new google.maps.places.PlacesService(mapRef.current);

        const bounds = mapRef.current.getBounds();
        const center = mapRef.current.getCenter();

        service.textSearch(
            {
                query,
                bounds: bounds || undefined,
                location: center,
                radius: 3000
            },
            (results, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                    setSearchCandidates(results);
                    setSelectedLocation(null);
                    setEditingSpotLocationId(null);

                    const newBounds = new google.maps.LatLngBounds();
                    results.forEach(place => {
                        if (place.geometry?.location) {
                            newBounds.extend(place.geometry.location);
                        }
                    });
                    mapRef.current?.fitBounds(newBounds);
                } else {
                    setSearchCandidates([]);
                    alert("在目前區域找不到相關結果 😥");
                }
            }
        );
    }, []);

    const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        if (pickingLocationForSpotId) {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                const address = status === 'OK' && results?.[0] ? results[0].formatted_address : "自選位置";
                updateSpot(pickingLocationForSpotId, { location: { lat, lng }, address });
                setPickingLocationForSpotId(null);
                setRightPanelMode('itinerary');
                setMobileView('list');
            });
            return;
        }

        setSelectedLocation(null);
        setSearchCandidates([]);
        setEditingSpotLocationId(null);

        if ((e as any).placeId) {
            e.stop();
            if (!mapRef.current) return;
            const service = new google.maps.places.PlacesService(mapRef.current);
            service.getDetails(
                {
                    placeId: (e as any).placeId,
                    fields: ['name', 'formatted_address', 'geometry', 'rating', 'website']
                },
                (place, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
                        setSelectedLocation({
                            lat: place.geometry.location.lat(),
                            lng: place.geometry.location.lng(),
                            name: place.name || "未知名稱",
                            address: place.formatted_address || "",
                            placeId: (e as any).placeId,
                            rating: place.rating,
                            website: place.website
                        });
                    }
                }
            );
        } else {
            setSelectedLocation({
                lat,
                lng,
                name: "自選地點",
                address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`
            });
        }
    }, [pickingLocationForSpotId, updateSpot]);

    const handlePlacePreview = useCallback((place: google.maps.places.PlaceResult) => {
        if (place.geometry?.location && place.name) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            if (mapRef.current) {
                mapRef.current.panTo({ lat, lng });
                mapRef.current.setZoom(15);
            }
            setSelectedLocation({
                lat,
                lng,
                name: place.name,
                address: place.formatted_address || "",
                placeId: place.place_id,
                rating: place.rating,
                website: place.website
            });
            setSearchCandidates([]);
            setEditingSpotLocationId(null);
        }
    }, []);

    const startDateObj = formatDate(startDate, 0);
    const endDateObj = formatDate(startDate, days.length - 1);
    const dateRangeString = `${startDateObj.iso} ~ ${endDateObj.iso}`;

    if (loadError) {
        return (
            <div className="p-10 text-red-500 font-bold">
                載入地圖失敗，請檢查 API Key。
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full bg-gray-50 overflow-hidden flex-col md:flex-row font-sans relative select-none">
            <TripSidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-30"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sync Status Indicator */}
            <div className="fixed bottom-4 left-4 z-[70] pointer-events-none">
                {syncStatus === 'saving' && (
                    <div className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
                        <Loader2 size={12} className="animate-spin" /> 自動儲存中...
                    </div>
                )}
                {syncStatus === 'saved' && (
                    <div className="bg-teal-600/90 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
                        <CheckCircle2 size={12} /> 已同步至雲端
                    </div>
                )}
                {syncStatus === 'error' && (
                    <div className="bg-red-500/90 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 backdrop-blur-md">
                        <CloudUpload size={12} /> 儲存失敗，請檢查網路
                    </div>
                )}
            </div>

            {/* Mobile View Toggle */}
            <button
                onClick={() => setMobileView(prev => prev === 'list' ? 'map' : 'list')}
                className="md:hidden fixed bottom-6 right-6 z-[60] bg-teal-600 text-white p-4 rounded-full shadow-2xl flex items-center justify-center animate-in zoom-in"
            >
                {mobileView === 'list' ? <MapIcon size={24} /> : <List size={24} />}
            </button>

            {/* Left Panel (Map) */}
            <div
                style={{ width: window.innerWidth >= 768 ? `${leftWidth}%` : '100%' }}
                className={`${mobileView === 'list' ? 'hidden md:block' : 'block'} h-full relative order-2 md:order-1 bg-gray-200`}
            >
                {!isLoaded ? (
                    <div className="flex h-full w-full items-center justify-center text-gray-500 gap-2">
                        <Loader2 className="animate-spin" /> 地圖載入中...
                    </div>
                ) : (
                    <>
                        <MapHeader onPlacePreview={handlePlacePreview} onTextSearch={handleTextSearch} />
                        {pickingLocationForSpotId && (
                            <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-40 bg-teal-600 text-white px-4 py-2 rounded-full shadow-lg font-bold animate-bounce flex items-center gap-2">
                                <MapPin size={16} /> 請點擊地圖選擇位置
                                <button
                                    onClick={() => setPickingLocationForSpotId(null)}
                                    className="bg-white/20 rounded-full p-0.5 ml-2"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        )}
                        <GoogleMap
                            mapContainerStyle={{ width: '100%', height: '100%' }}
                            center={mapCenter}
                            zoom={DEFAULT_ZOOM}
                            options={{
                                disableDefaultUI: true,
                                zoomControl: true,
                                gestureHandling: 'greedy',
                                styles: []
                            }}
                            onClick={onMapClick}
                            onDragStart={() => setSelectedLocation(null)}
                            onLoad={onLoadMap}
                            onUnmount={onUnmountMap}
                        >
                            {validSpots.map((spot, index) => (
                                <Marker
                                    key={spot.id}
                                    position={spot.location}
                                    label={{
                                        text: (index + 1).toString(),
                                        color: "white",
                                        fontWeight: "bold"
                                    }}
                                    onClick={() => {
                                        setSelectedLocation({
                                            lat: spot.location.lat,
                                            lng: spot.location.lng,
                                            name: spot.name,
                                            address: spot.address || '',
                                            rating: spot.rating,
                                            website: spot.website,
                                            existingSpotId: spot.id
                                        });
                                        setSearchCandidates([]);
                                    }}
                                />
                            ))}

                            {searchCandidates.map((place) =>
                                place.geometry?.location && (
                                    <Marker
                                        key={place.place_id}
                                        position={place.geometry.location}
                                        icon={{ url: "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png" }}
                                        onClick={() => {
                                            setSelectedLocation({
                                                lat: place.geometry!.location!.lat(),
                                                lng: place.geometry!.location!.lng(),
                                                name: place.name || "搜尋結果",
                                                address: place.formatted_address || "",
                                                placeId: place.place_id,
                                                rating: place.rating,
                                                website: place.website
                                            });
                                        }}
                                    />
                                )
                            )}

                            <Polyline
                                path={polylinePath}
                                options={{ strokeColor: "#0d9488", strokeOpacity: 0.8, strokeWeight: 4 }}
                            />

                            {selectedLocation && (
                                <InfoWindow
                                    position={{ lat: selectedLocation.lat, lng: selectedLocation.lng }}
                                    onCloseClick={() => {
                                        setSelectedLocation(null);
                                        setEditingSpotLocationId(null);
                                    }}
                                    options={{ headerDisabled: true }}
                                >
                                    <div className="p-0 min-w-[200px]">
                                        <h3 className="font-bold text-gray-800 mb-1">{selectedLocation.name}</h3>
                                        <p className="text-xs text-gray-500 mb-2">{selectedLocation.address}</p>
                                        {selectedLocation.rating && (
                                            <div className="text-xs text-yellow-500 mb-2">★ {selectedLocation.rating}</div>
                                        )}

                                        {selectedLocation.existingSpotId ? (
                                            <button
                                                onClick={() => {
                                                    removeSpot(selectedLocation.existingSpotId!);
                                                    setSelectedLocation(null);
                                                }}
                                                disabled={isLocked}
                                                className={`w-full text-white text-sm font-bold py-1.5 rounded-md transition-colors flex items-center justify-center gap-1 ${
                                                    isLocked
                                                        ? 'bg-gray-300 cursor-not-allowed'
                                                        : 'bg-red-500 hover:bg-red-600'
                                                }`}
                                            >
                                                <Trash2 size={14} /> 刪除此景點
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    if (editingSpotLocationId) {
                                                        updateSpot(editingSpotLocationId, {
                                                            name: selectedLocation.name,
                                                            location: { lat: selectedLocation.lat, lng: selectedLocation.lng },
                                                            address: selectedLocation.address,
                                                            website: selectedLocation.website,
                                                            rating: selectedLocation.rating
                                                        });
                                                        setEditingSpotLocationId(null);
                                                        setMobileView('list');
                                                    } else {
                                                        addSpot({
                                                            name: selectedLocation.name,
                                                            location: { lat: selectedLocation.lat, lng: selectedLocation.lng },
                                                            address: selectedLocation.address,
                                                            website: selectedLocation.website,
                                                            rating: selectedLocation.rating
                                                        });
                                                        setMobileView('list');
                                                    }
                                                    setSelectedLocation(null);
                                                    setSearchCandidates([]);
                                                    setRightPanelMode('itinerary');
                                                }}
                                                disabled={isLocked}
                                                className={`w-full text-white text-sm font-bold py-1.5 rounded-md transition-colors flex items-center justify-center gap-1 ${
                                                    isLocked
                                                        ? 'bg-gray-300 cursor-not-allowed'
                                                        : editingSpotLocationId
                                                        ? 'bg-orange-500 hover:bg-orange-600'
                                                        : 'bg-teal-600 hover:bg-teal-700'
                                                }`}
                                            >
                                                {editingSpotLocationId ? (
                                                    <>
                                                        <CheckCircle2 size={14} /> 更新此景點位置
                                                    </>
                                                ) : (
                                                    <>
                                                        <Plus size={14} /> 加入行程
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </InfoWindow>
                            )}
                        </GoogleMap>
                    </>
                )}
            </div>

            <ResizeHandle
                onMouseDown={startResizing}
                onDoubleClick={() => setLeftWidth(60)}
            />

            {/* Right Panel (Itinerary) */}
            <div
                style={{ width: window.innerWidth >= 768 ? `${100 - leftWidth}%` : '100%' }}
                className={`${mobileView === 'map' ? 'hidden md:flex' : 'flex'} h-full flex-col bg-[#f0f2f5] order-1 md:order-2 z-20 shadow-xl overflow-hidden relative`}
            >
                {/* Header */}
                <div className="bg-teal-700 text-white px-4 py-3 shadow-md z-10 shrink-0">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="p-1.5 hover:bg-teal-600 rounded-lg transition-colors"
                            >
                                <Menu size={20} />
                            </button>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <div className="text-lg font-bold truncate flex items-center gap-2">
                                    {tripName}
                                    <span className="text-xs bg-teal-800/50 px-2 py-0.5 rounded font-normal text-teal-100">
                                        {destination}
                                    </span>
                                    {isLocked && <Lock size={14} className="text-teal-200" />}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-teal-200 mt-0.5 group relative w-fit">
                                    <CalendarIcon size={10} />
                                    <span>{dateRangeString}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                            <button
                                onClick={() => setRightPanelMode('itinerary')}
                                className={`p-2 rounded-lg transition-colors ${
                                    rightPanelMode === 'itinerary'
                                        ? 'bg-teal-900 text-white'
                                        : 'bg-teal-800/50 text-teal-100 hover:bg-teal-600'
                                }`}
                                title="行程"
                            >
                                <List size={16} />
                            </button>
                            <button
                                onClick={() => setRightPanelMode('translate')}
                                className={`p-2 rounded-lg transition-colors ${
                                    rightPanelMode === 'translate'
                                        ? 'bg-teal-900 text-white'
                                        : 'bg-teal-800/50 text-teal-100 hover:bg-teal-600'
                                }`}
                                title="翻譯"
                            >
                                <Languages size={16} />
                            </button>
                            <button
                                onClick={() => window.open('https://www.google.com/maps', '_blank')}
                                className="p-2 bg-teal-800/50 text-teal-100 rounded-lg hover:bg-teal-600 transition-colors"
                                title="開啟 Google 地圖"
                            >
                                <MapIcon size={16} />
                            </button>
                            <button
                                onClick={() => setRightPanelMode('budget')}
                                className={`p-2 rounded-lg transition-colors ${
                                    rightPanelMode === 'budget'
                                        ? 'bg-teal-900 text-white'
                                        : 'bg-teal-800/50 text-teal-100 hover:bg-teal-600'
                                }`}
                                title="預算"
                            >
                                <Wallet size={16} />
                            </button>
                        </div>
                    </div>

                    {rightPanelMode === 'itinerary' && (
                        <DayTabs
                            days={days}
                            currentDayIndex={currentDayIndex}
                            startDate={startDate}
                            onDayClick={setCurrentDayIndex}
                            onDayDelete={deleteDay}
                            onDayDragEnd={handleDayDragEnd}
                            onAddDay={addDay}
                            isLocked={isLocked ?? false}
                            sensors={sensors}
                        />
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-[#f0f2f5] relative">
                    {rightPanelMode === 'itinerary' && (
                        <>
                            <DayHeader
                                day={currentDayData}
                                dayIndex={currentDayIndex}
                                startDate={startDate}
                                isLocked={isLocked ?? false}
                                isMapLoaded={isLoaded}
                                validSpots={validSpots}
                                onLocationChange={(val: string) => updateDayInfo(currentDayIndex, { customLocation: val })}
                                onLocationSelect={(lat: number, lng: number, name: string) => {
                                    updateDayInfo(currentDayIndex, { customLocation: name, customLat: lat, customLng: lng });
                                }}
                            />

                            <div className="px-4 pb-4">
                                {currentDayIndex === 0 && (
                                    <div className="mb-2">
                                        <FlightCard
                                            type="outbound"
                                            flight={outbound}
                                            onUpdate={(info) => updateFlight('outbound', info)}
                                            isLocked={isLocked ?? false}
                                        />
                                    </div>
                                )}

                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                    <SortableContext items={currentSpots} strategy={verticalListSortingStrategy}>
                                        {currentSpots.map((spot, index) => (
                                            <SpotCard
                                                key={spot.id}
                                                spot={spot}
                                                index={index}
                                                updateSpot={updateSpot}
                                                removeSpot={removeSpot}
                                                savedCategories={savedCategories}
                                                addCategory={addCategory}
                                                removeCategory={removeCategory}
                                                setPickingLocation={(id: string) => {
                                                    setPickingLocationForSpotId(id);
                                                    setMobileView('map');
                                                }}
                                                onAutoLocate={handleAutoLocate}
                                                isLocked={isLocked ?? false}
                                            />
                                        ))}
                                    </SortableContext>
                                </DndContext>

                                {!isLocked && (
                                    <button
                                        onClick={addEmptySpot}
                                        className="w-full py-3 mb-8 rounded-xl border-2 border-dashed border-teal-200 text-teal-600 font-bold flex items-center justify-center gap-2 hover:bg-teal-50 hover:border-teal-400 transition-all text-sm"
                                    >
                                        <Plus size={16} /> 新增行程
                                    </button>
                                )}

                                {currentDayIndex === days.length - 1 && (
                                    <div className="mb-4">
                                        <FlightCard
                                            type="inbound"
                                            flight={inbound}
                                            onUpdate={(info) => updateFlight('inbound', info)}
                                            isLocked={isLocked ?? false}
                                        />
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {rightPanelMode === 'translate' && <TranslateView />}
                    {rightPanelMode === 'budget' && <BudgetView />}
                </div>
            </div>
        </div>
    );
}
