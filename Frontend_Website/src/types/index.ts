export type TransportMode = 'public' | 'car';
export type WalkingPreference = 'low' | 'medium' | 'high';
export type BudgetLevel = 'free' | 'low' | 'normal' | 'luxury';
export type CompanionType = 'solo' | 'couple' | 'family' | 'friends';
export type RestaurantPreference = 'local' | 'vegan' | 'vegetarian' | 'only_chicken' | 'no_pork' | 'no_beef' | 'everything';

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface Interest {
  id: string;
  name: string;
  priority: number;
  isCustom?: boolean;
}

export interface Citation {
  source: string;
  timestamp: string;
  url?: string;
}

export interface Stop {
  id: string;
  name: string;
  category: string;
  location: Location;
  arrivalTime: string;
  dwellMinutes: number;
  bufferMinutes: number;
  significance: string;
  preferenceFit: string;
  citations: Citation[];
  officialLink?: string;
  priority: number;
  narrationScript?: string;
  narrationAudioUrl?: string;
}

export interface RouteSegment {
  from: string;
  to: string;
  mode: 'walking' | 'transit' | 'driving';
  color: string;
  coordinates: Location[];
}

export interface TripConfig {
  city: string;
  arrivalDate: string;
  arrivalTime: string;
  returnDate: string;
  returnTime: string;
  accommodation?: Location;
  companions: CompanionType;
  transport: TransportMode;
  walkingPreference: WalkingPreference;
  bufferTime: number;
  interests: Interest[];
  budget: BudgetLevel;
  restaurantPreferences: RestaurantPreference[];
  mustSee?: string[];
  mustAvoid?: string[];
}

export interface DailyPlan {
  id: string;
  date: string;
  stops: Stop[];
  routes: RouteSegment[];
  sunrise: string;
  sunset: string;
  weather?: {
    temp: number;
    condition: string;
    rainProbability?: number;
  };
}

export interface PlanReview {
  approved: boolean;
  feedback?: string;
  missingElements?: string;
}

export interface AppState {
  currentStep: 'setup' | 'setup2' | 'preferences' | 'generating' | 'plan' | 'navigating';
  tripConfig?: TripConfig;
  dailyPlan?: DailyPlan;
  currentLocation?: Location;
  selectedStop?: Stop;
}
