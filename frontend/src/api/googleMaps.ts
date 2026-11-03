import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import type { LocationPoint, RouteResult } from '../types'

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

if (!apiKey) {
  console.warn('VITE_GOOGLE_MAPS_API_KEY is missing — check .env.local')
}

let mapsPromise: Promise<typeof google> | null = null

export async function loadGoogleMaps(): Promise<typeof google> {
  if (!mapsPromise) {
    setOptions({
      key: apiKey ?? '',
      v: 'weekly',
    })

    mapsPromise = Promise.all([
      importLibrary('maps'),
      importLibrary('places'),
      importLibrary('geometry'),
    ]).then(() => google)
  }

  return mapsPromise
}

export function onMapsAuthFailure(handler: () => void): void {
  window.gm_authFailure = handler
}

export async function attachAutocomplete(
  input: HTMLInputElement,
  onSelect: (point: LocationPoint) => void,
): Promise<google.maps.places.Autocomplete> {
  await loadGoogleMaps()

  const autocomplete = new google.maps.places.Autocomplete(input, {
    fields: ['formatted_address', 'geometry', 'place_id'],
  })

  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace()

    if (!place.geometry?.location) return

    onSelect({
      address: place.formatted_address ?? input.value,
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
      placeId: place.place_id,
    })
  })

  return autocomplete
}

export async function computeRoute(
  origin: LocationPoint,
  destination: LocationPoint,
): Promise<RouteResult> {
  let response: Response

  try {
    response = await fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey ?? '',
          'X-Goog-FieldMask':
            'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: {
                latitude: origin.lat,
                longitude: origin.lng,
              },
            },
          },
          destination: {
            location: {
              latLng: {
                latitude: destination.lat,
                longitude: destination.lng,
              },
            },
          },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
        }),
      },
    )
  } catch {
    throw new Error('Network error while calculating the route.')
  }

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        'Google Maps API key is invalid or missing permissions.',
      )
    }

    throw new Error('Could not calculate the route. Please try again.')
  }

  const data = await response.json()
  const route = data.routes?.[0]

  if (!route) {
    throw new Error('No route found between these locations.')
  }

  const durationSeconds =
    parseInt(String(route.duration ?? '0').replace('s', ''), 10) || 0

  return {
    distanceKm:
      Math.round((route.distanceMeters / 1000) * 10) / 10,
    durationMin: Math.round(durationSeconds / 60),
    polyline: route.polyline?.encodedPolyline ?? '',
  }
}

const geocodeCache = new Map<string, Promise<{ lat: number; lng: number } | null>>()

/**
 * Coordinates for an address, for older bookings saved without them.
 * Cached per address so each one is looked up only once.
 */
export function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const key = address.trim()
  if (!key) return Promise.resolve(null)

  let pending = geocodeCache.get(key)
  if (!pending) {
    pending = loadGoogleMaps()
      .then(
        () =>
          new Promise<{ lat: number; lng: number } | null>((resolve) => {
            new google.maps.Geocoder().geocode({ address: key }, (results, status) => {
              const loc = status === 'OK' ? results?.[0]?.geometry?.location : undefined
              resolve(loc ? { lat: loc.lat(), lng: loc.lng() } : null)
            })
          }),
      )
      .catch(() => null)
    geocodeCache.set(key, pending)
  }
  return pending
}

declare global {
  interface Window {
    gm_authFailure?: () => void
  }
}
