import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { haversineKm } from '../common/format';
import { AppConfig } from '../config/app-config.service';
import { RedisService } from '../core/redis.service';

interface Point {
  lat: number;
  lng: number;
}

const AVERAGE_SPEED_KMH = 40;
const ROAD_FACTOR = 1.4;

/**
 * Geocoding & ETA. Memakai Google Maps Platform bila GOOGLE_MAPS_API_KEY diisi;
 * tanpa key: OpenStreetMap Nominatim untuk alamat dan estimasi garis lurus untuk ETA.
 */
@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);
  private readonly http = axios.create({ timeout: 5000, headers: { 'User-Agent': 'AdamPreCare/0.1 (dev)', 'Accept-Language': 'id' } });

  constructor(
    private readonly config: AppConfig,
    private readonly redis: RedisService,
  ) {}

  private get googleKey() {
    return this.config.get('GOOGLE_MAPS_API_KEY');
  }

  async reverse(lat: number, lng: number): Promise<string> {
    const key = `geo:rev:${lat.toFixed(5)},${lng.toFixed(5)}`;
    const cached = await this.redis.client.get(key);
    if (cached) return cached;
    let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    try {
      if (this.googleKey) {
        const { data } = await this.http.get('https://maps.googleapis.com/maps/api/geocode/json', {
          params: { latlng: `${lat},${lng}`, key: this.googleKey, language: 'id' },
        });
        address = data.results?.[0]?.formatted_address ?? address;
      } else {
        const { data } = await this.http.get('https://nominatim.openstreetmap.org/reverse', {
          params: { lat, lon: lng, format: 'jsonv2', zoom: 18 },
        });
        address = data.display_name ?? address;
      }
      await this.redis.client.set(key, address, 'EX', 86400);
    } catch (err) {
      this.logger.warn(`Reverse geocode gagal: ${(err as Error).message}`);
    }
    return address;
  }

  async search(q: string): Promise<{ address: string; lat: number; lng: number }[]> {
    const key = `geo:search:${q.toLowerCase()}`;
    const cached = await this.redis.getJson<{ address: string; lat: number; lng: number }[]>(key);
    if (cached) return cached;
    let results: { address: string; lat: number; lng: number }[] = [];
    try {
      if (this.googleKey) {
        const { data } = await this.http.get('https://maps.googleapis.com/maps/api/geocode/json', {
          params: { address: q, key: this.googleKey, language: 'id', region: 'id' },
        });
        results = (data.results ?? []).slice(0, 5).map((r: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }) => ({
          address: r.formatted_address,
          lat: r.geometry.location.lat,
          lng: r.geometry.location.lng,
        }));
      } else {
        const { data } = await this.http.get('https://nominatim.openstreetmap.org/search', {
          params: { q, format: 'jsonv2', countrycodes: 'id', limit: 5 },
        });
        results = (data ?? []).map((r: { display_name: string; lat: string; lon: string }) => ({
          address: r.display_name,
          lat: Number(r.lat),
          lng: Number(r.lon),
        }));
      }
      await this.redis.setJson(key, results, 86400);
    } catch (err) {
      this.logger.warn(`Pencarian alamat gagal: ${(err as Error).message}`);
    }
    return results;
  }

  /** ETA dalam detik, di-cache 30 detik per kunci (mis. id permintaan). */
  async eta(cacheKey: string, from: Point, to: Point): Promise<number> {
    const key = `geo:eta:${cacheKey}`;
    const cached = await this.redis.client.get(key);
    if (cached) return Number(cached);
    let seconds = Math.round(((haversineKm(from, to) * ROAD_FACTOR) / AVERAGE_SPEED_KMH) * 3600);
    if (this.googleKey) {
      try {
        const { data } = await this.http.post(
          'https://routes.googleapis.com/directions/v2:computeRoutes',
          {
            origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
            destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
            travelMode: 'DRIVE',
            routingPreference: 'TRAFFIC_AWARE',
          },
          { headers: { 'X-Goog-Api-Key': this.googleKey, 'X-Goog-FieldMask': 'routes.duration' } },
        );
        const duration: string | undefined = data.routes?.[0]?.duration;
        if (duration) seconds = parseInt(duration, 10);
      } catch (err) {
        this.logger.warn(`Routes API gagal, pakai estimasi: ${(err as Error).message}`);
      }
    }
    await this.redis.client.set(key, String(seconds), 'EX', 30);
    return seconds;
  }
}
