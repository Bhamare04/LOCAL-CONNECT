/* eslint-disable react/prop-types */
import { useCallback, useState } from 'react';
import {
  Check,
  Clock3,
  CloudRain,
  ExternalLink,
  IndianRupee,
  MapPin,
  Navigation,
  Sparkles,
  Thermometer,
  Wind,
  X
} from 'lucide-react';
import { motion } from 'framer-motion';
import { GlassButton, GlassCard, Badge } from '../components/common/UIComponents';
import RecommendationSection from '../components/recommendations/RecommendationSection';

const CITIES = [
  'Mumbai',
  'Jaipur',
  'Surat',
  'Nashik',
  'Vadodara',
  'Bengaluru',
  'New Delhi',
  'Chennai',
  'Hyderabad',
  'Kolkata',
];

const INTERESTS = [
  'Nature',
  'Historical',
  'Cultural',
  'Religious',
  'Sightseeing',
  'Attraction',
];

const TravelRecommendations = () => {
  const [city, setCity] = useState('');
  const [interests, setInterests] = useState([]);
  const [budget, setBudget] = useState('');
  const [durationHours, setDurationHours] = useState('');
  const [submittedPreferences, setSubmittedPreferences] = useState(null);
  const [requestKey, setRequestKey] = useState(0);
  const [location, setLocation] = useState(null);
  const [locationMessage, setLocationMessage] = useState('');
  const [weather, setWeather] = useState(null);
  const [weatherAvailable, setWeatherAvailable] = useState(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);

  const handleRecommendationResponse = useCallback((result) => {
    setWeather(result.weather || null);
    setWeatherAvailable(result.weather_available === true && Boolean(result.weather));
  }, []);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Location is not available in this browser. You can continue without location.');
      return;
    }

    setLocationMessage('Detecting your current location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setLocationMessage('Current location detected');
      },
      () => {
        setLocation(null);
        setLocationMessage('Location permission denied. You can continue without location.');
      }
    );
  };

  const toggleInterest = (interest) => {
    setInterests((currentInterests) =>
      currentInterests.includes(interest)
        ? currentInterests.filter((item) => item !== interest)
        : [...currentInterests, interest]
    );
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmittedPreferences({
      city,
      interests,
      budget,
      durationHours,
      originLatitude: location?.latitude ?? null,
      originLongitude: location?.longitude ?? null
    });
    setRequestKey((currentKey) => currentKey + 1);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-36 pb-24">
      <div className="max-w-6xl mx-auto">
        <motion.header
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-3xl mb-12"
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-accent-light" />
            <span className="text-xs font-bold tracking-widest text-accent-light uppercase">
              AI-powered travel planning
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight drop-shadow-md">
            Travel Recommendations
          </h1>
          <p className="text-white/60 text-lg mt-4">
            Find places personalized to your interests, preferences and current conditions.
          </p>
        </motion.header>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <GlassCard className="mb-16 rounded-[2rem] border-white/10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-brand/20 text-brand-light flex items-center justify-center">
                <MapPin size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">Plan Your Experience</h2>
                <p className="text-white/45 text-sm mt-1">Choose what you want to discover.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="text-sm font-bold text-white/70">
                City
                <select
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  required
                  className="mt-2 w-full rounded-2xl bg-white/5 border border-white/10 text-white px-4 py-3 outline-none focus:border-brand/60"
                >
                  <option value="" className="bg-[#1e1b4b]">Select a city</option>
                  {CITIES.map((cityName) => (
                    <option key={cityName} value={cityName} className="bg-[#1e1b4b]">
                      {cityName}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="text-sm font-bold text-white/70">Interests</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {INTERESTS.map((interest) => {
                    const selected = interests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleInterest(interest)}
                        className={`px-3 py-2 rounded-full text-sm border transition-colors ${
                          selected
                            ? 'bg-brand/20 text-brand-light border-brand/50'
                            : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'
                        }`}
                        aria-pressed={selected}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="text-sm font-bold text-white/70">
                Budget <span className="font-normal text-white/35">(optional)</span>
                <div className="mt-2 relative">
                  <IndianRupee size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="number"
                    min="0"
                    value={budget}
                    onChange={(event) => setBudget(event.target.value)}
                    placeholder="1000"
                    className="w-full rounded-2xl bg-white/5 border border-white/10 text-white pl-10 pr-4 py-3 outline-none focus:border-brand/60"
                  />
                </div>
              </label>

              <label className="text-sm font-bold text-white/70">
                Duration <span className="font-normal text-white/35">(optional, hours)</span>
                <div className="mt-2 relative">
                  <Clock3 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={durationHours}
                    onChange={(event) => setDurationHours(event.target.value)}
                    placeholder="6"
                    className="w-full rounded-2xl bg-white/5 border border-white/10 text-white pl-10 pr-4 py-3 outline-none focus:border-brand/60"
                  />
                </div>
              </label>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <GlassButton
                  type="button"
                  variant="outline"
                  className="px-5 py-3"
                  onClick={detectLocation}
                >
                  <Navigation size={17} />
                  Use My Current Location
                </GlassButton>
                {locationMessage && (
                  <p className={`flex items-center gap-2 text-sm mt-3 ${
                    location ? 'text-emerald-300' : 'text-white/50'
                  }`}>
                    {location && <Check size={15} />}
                    {locationMessage}
                  </p>
                )}
              </div>
              <GlassButton type="submit" variant="primary" className="px-6 py-3">
                <Sparkles size={17} />
                Find Recommendations
              </GlassButton>
            </div>
          </GlassCard>
        </motion.form>

        {submittedPreferences && (
          <WeatherSummary weather={weather} available={weatherAvailable} />
        )}

        {submittedPreferences && (
          <RecommendationSection
            city={submittedPreferences.city}
            interests={submittedPreferences.interests}
            budget={submittedPreferences.budget}
            durationHours={submittedPreferences.durationHours}
            requestKey={requestKey}
            originLatitude={submittedPreferences.originLatitude}
            originLongitude={submittedPreferences.originLongitude}
            onResponse={handleRecommendationResponse}
            onSelect={setSelectedRecommendation}
            weather={weather}
            weatherAvailable={weatherAvailable}
          />
        )}

        {!submittedPreferences && (
          <GlassCard className="rounded-[2rem] border-white/10 text-center py-12">
            <Badge variant="accent">Personalized planning</Badge>
            <p className="text-white/50 mt-4">
              Select your preferences to discover places picked for your trip.
            </p>
          </GlassCard>
        )}
      </div>

      {selectedRecommendation && (
        <PlaceDetails
          recommendation={selectedRecommendation}
          weather={weather}
          onClose={() => setSelectedRecommendation(null)}
        />
      )}
    </div>
  );
};

const WeatherSummary = ({ weather, available }) => (
  <section className="mb-16">
    <div className="flex items-center gap-2 mb-5">
      <CloudRain size={18} className="text-accent-light" />
      <h2 className="text-2xl font-black text-white">Current Weather</h2>
    </div>
    <GlassCard className="rounded-[2rem] border-white/10">
      {!available ? (
        <p className="text-white/55">Weather information unavailable</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <WeatherValue icon={<Thermometer size={18} />} label="Temperature" value={weather.temperature} suffix="°C" />
          <WeatherValue icon={<CloudRain size={18} />} label="Rain" value={weather.precipitation} suffix=" mm" />
          <WeatherValue icon={<Wind size={18} />} label="Wind" value={weather.wind_speed} suffix=" km/h" />
        </div>
      )}
    </GlassCard>
  </section>
);

const WeatherValue = ({ icon, label, value, suffix }) => (
  <div className="flex items-center gap-3 text-white/70">
    <span className="text-brand-light">{icon}</span>
    <div>
      <p className="text-xs uppercase tracking-wider text-white/40">{label}</p>
      <p className="text-lg font-bold text-white">
        {value === null || value === undefined ? 'Unavailable' : `${value}${suffix}`}
      </p>
    </div>
  </div>
);

const PlaceDetails = ({ recommendation, weather, onClose }) => {
  const score = Number(recommendation.recommendation_score);
  const hasDistance =
    recommendation.distance_km !== null &&
    recommendation.distance_km !== undefined &&
    recommendation.distance_km !== '' &&
    Number.isFinite(Number(recommendation.distance_km));

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <GlassCard className="rounded-[2rem] border-white/10 bg-[#1e1b4b]/95">
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <Badge variant="accent">{recommendation.category || 'Place'}</Badge>
              <h2 className="text-3xl font-black text-white mt-3">{recommendation.place_name}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10"
              aria-label="Close place details"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm text-white/65">
            <p className="flex items-center gap-2">
              <MapPin size={16} className="text-brand-light" />
              {recommendation.city || 'City unavailable'}
            </p>
            <p className="text-brand-light font-black text-lg">
              {Number.isFinite(score) ? `${Math.round(Math.max(0, Math.min(1, score)) * 100)}% MATCH` : 'MATCH unavailable'}
            </p>
            {hasDistance && <p>{Number(recommendation.distance_km).toFixed(1)} km away</p>}
            {recommendation.address && <p className="sm:col-span-2">{recommendation.address}</p>}
          </div>

          {weather && (
            <div className="mt-8 pt-6 border-t border-white/10">
              <h3 className="text-lg font-bold text-white mb-4">Weather at this place</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <WeatherValue icon={<Thermometer size={18} />} label="Temperature" value={weather.temperature} suffix="°C" />
                <WeatherValue icon={<CloudRain size={18} />} label="Rain" value={weather.precipitation} suffix=" mm" />
                <WeatherValue icon={<Wind size={18} />} label="Wind" value={weather.wind_speed} suffix=" km/h" />
              </div>
            </div>
          )}

          {recommendation.google_maps_url && (
            <GlassButton
              variant="primary"
              className="w-full mt-8 py-3"
              onClick={() => window.open(recommendation.google_maps_url, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink size={17} />
              Open in Google Maps
            </GlassButton>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
};

export default TravelRecommendations;
