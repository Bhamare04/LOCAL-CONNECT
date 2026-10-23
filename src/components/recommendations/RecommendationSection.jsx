/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CloudRain,
  ExternalLink,
  MapPin,
  Sparkles,
  Thermometer,
  Wind
} from 'lucide-react';
import { motion } from 'framer-motion';
import { GlassButton, GlassCard, Badge } from '../common/UIComponents';

const BACKEND_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001';

const RecommendationSection = ({
  city,
  interests = [],
  budget = '',
  durationHours = '',
  requestKey = 0,
  enabled = true,
  originLatitude = null,
  originLongitude = null,
  onResponse,
  onSelect,
  weather = null,
  weatherAvailable = false,
}) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled || !city) {
      setRecommendations([]);
      return undefined;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ city });
    if (interests.length > 0) {
      params.set('interests', interests.join(','));
    }
    if (budget !== '') {
      params.set('budget', budget);
    }
    if (durationHours !== '') {
      params.set('duration_hours', durationHours);
    }
    if (originLatitude !== null && originLongitude !== null) {
      params.set('origin_latitude', originLatitude);
      params.set('origin_longitude', originLongitude);
    }

    const fetchRecommendations = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(
          `${BACKEND_URL}/api/travel/recommendations?${params.toString()}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error(`Recommendation request failed with status ${response.status}.`);
        }

        const result = await response.json();
        const nextRecommendations = Array.isArray(result.recommendations)
          ? result.recommendations
          : [];
        setRecommendations(nextRecommendations);
        onResponse?.(result);
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          console.error('Recommendation request failed:', requestError);
          setRecommendations([]);
          setError('Unable to load personalized recommendations right now.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchRecommendations();
    return () => controller.abort();
  }, [
    budget,
    city,
    durationHours,
    enabled,
    interests,
    onResponse,
    originLatitude,
    originLongitude,
    requestKey
  ]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7 }}
      className="mb-24"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={18} className="text-accent-light" />
            <span className="text-xs font-bold tracking-widest text-accent-light uppercase">
              AI-powered recommendations
            </span>
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight drop-shadow-md">
            Recommended For You
          </h2>
          <p className="text-white/50 mt-2">
            Personalized recommendations based on your interests, location and current conditions.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-16 glass rounded-[2rem] border-white/10">
          <div className="flex items-center gap-4 text-white/60 font-medium">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-full border-4 border-white/10" />
              <div className="absolute inset-0 rounded-full border-4 border-brand border-t-transparent animate-spin" />
            </div>
            Finding recommendations...
          </div>
        </div>
      ) : error ? (
        <div className="glass rounded-[2rem] border-white/10 px-6 py-8 text-center text-white/60">
          {error}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="glass rounded-[2rem] border-white/10 px-6 py-8 text-center text-white/60">
          No matching places found. Try changing your preferences.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendations.map((recommendation, index) => {
            const score = Number(recommendation.recommendation_score);
            const scorePercent = Number.isFinite(score)
              ? `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`
              : '—';
            const hasDistance =
              recommendation.distance_km !== null &&
              recommendation.distance_km !== undefined &&
              recommendation.distance_km !== '' &&
              Number.isFinite(Number(recommendation.distance_km));

            return (
              <motion.div
                key={recommendation.place_id || `${recommendation.place_name}-${index}`}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
              >
                <GlassCard
                  className="h-full flex flex-col bg-white/5 border-white/10 hover:bg-white/10 rounded-[2rem] cursor-pointer"
                  onClick={() => onSelect?.(recommendation)}
                >
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div>
                      <h3 className="text-xl font-black text-white mb-2">
                        {recommendation.place_name}
                      </h3>
                      <Badge variant="accent">{recommendation.category || 'Place'}</Badge>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-brand-light text-2xl font-black">{scorePercent}</div>
                      <div className="text-white/40 text-xs font-bold uppercase tracking-wider">
                        match
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 text-sm text-white/55">
                    <p className="flex items-start gap-2">
                      <MapPin size={16} className="text-brand-light mt-0.5 shrink-0" />
                      <span>{recommendation.address || recommendation.city || city}</span>
                    </p>
                    {hasDistance && (
                      <p className="text-white/40">
                        {Number(recommendation.distance_km).toFixed(1)} km away
                      </p>
                    )}
                    {weatherAvailable && weather && (
                      <CardWeather city={city} weather={weather} />
                    )}
                    <RecommendationReasons recommendation={recommendation} />
                  </div>

                  <GlassButton
                    variant="outline"
                    className="w-full mt-6 py-3 text-sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (recommendation.google_maps_url) {
                        window.open(recommendation.google_maps_url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  >
                    <ExternalLink size={16} />
                    View on Map
                  </GlassButton>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.section>
  );
};

const WEATHER_CONDITIONS = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with heavy hail'
};

const CardWeather = ({ city, weather }) => {
  const hasTemperature = weather.temperature !== null && weather.temperature !== undefined;
  const hasPrecipitation = weather.precipitation !== null && weather.precipitation !== undefined;
  const hasWind = weather.wind_speed !== null && weather.wind_speed !== undefined;
  const hasCondition = weather.weather_code !== null && weather.weather_code !== undefined;

  return (
    <div className="mt-4 pt-4 border-t border-white/10">
      <p className="text-xs uppercase tracking-wider text-white/40 mb-3">
        Current weather in {city}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs text-white/60">
        {hasTemperature && (
          <span className="flex items-center gap-1.5">
            <Thermometer size={14} className="text-brand-light" />
            {Number(weather.temperature).toFixed(1)}°C
          </span>
        )}
        {hasCondition && (
          <span className="flex items-center gap-1.5">
            <CloudRain size={14} className="text-accent-light" />
            {WEATHER_CONDITIONS[weather.weather_code] || `Weather code ${weather.weather_code}`}
          </span>
        )}
        {hasPrecipitation && <span>Rain: {weather.precipitation} mm</span>}
        {hasWind && (
          <span className="flex items-center gap-1.5">
            <Wind size={14} className="text-accent-light" />
            Wind: {weather.wind_speed} km/h
          </span>
        )}
      </div>
    </div>
  );
};

const RecommendationReasons = ({ recommendation }) => {
  const hasDistance =
    recommendation.distance_km !== null &&
    recommendation.distance_km !== undefined &&
    recommendation.distance_km !== '' &&
    Number.isFinite(Number(recommendation.distance_km));
  const distanceSuitability = Number(recommendation.distance_suitability);
  const reasons = [];

  if (Number(recommendation.interest_match) > 0) {
    reasons.push({ positive: true, text: 'Matches your interests' });
  }

  if (Number(recommendation.weather_suitability) > 0.5) {
    reasons.push({ positive: true, text: 'Good weather for visiting' });
  } else if (
    recommendation.weather_suitability !== null &&
    recommendation.weather_suitability !== undefined &&
    Number.isFinite(Number(recommendation.weather_suitability))
  ) {
    reasons.push({ positive: false, text: 'Weather may affect your visit' });
  }

  if (hasDistance && Number.isFinite(distanceSuitability)) {
    reasons.push(
      distanceSuitability >= 0.5
        ? { positive: true, text: 'Convenient distance' }
        : { positive: false, text: 'Relatively far from your current location' }
    );
  }

  if (Number(recommendation.city_match) > 0) {
    reasons.push({ positive: true, text: 'Located in your selected city' });
  }

  if (reasons.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 pt-4 border-t border-white/10">
      <p className="text-xs uppercase tracking-wider text-white/40 mb-2">
        Why this place is recommended
      </p>
      <ul className="space-y-1.5 text-xs text-white/60">
        {reasons.map((reason) => (
          <li key={reason.text} className="flex items-start gap-2">
            {reason.positive ? (
              <Check size={14} className="text-emerald-300 mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle size={14} className="text-amber-300 mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <span>{reason.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RecommendationSection;
