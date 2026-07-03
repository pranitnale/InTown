# InTown - AI Travel Planner

A beautiful, responsive web application (PWA) that helps travelers plan their perfect day with AI-powered itinerary generation.

## Features

### Trip Setup
- City selection with arrival/return dates and times
- Accommodation location (current location or manual address)
- Travel companion selection (solo, couple, family, friends)
- Transportation mode (public transit or rental car)
- Walking preference customization
- Buffer time adjustment for pacing

### Preferences
- Drag-and-drop interest prioritization
- Custom interests support
- Budget level selection (free, low, normal, luxury)
- Dining preferences (local, vegan, vegetarian, etc.)
- Visual priority ranking

### Plan Generation
- AI-powered itinerary creation (simulated)
- Route-aware stop ordering
- Weather-aware planning
- Arrival times and dwell durations
- Buffer time calculations

### Interactive Plan View
- **Map visualization** with stop markers and routes
- **Timeline view** showing Now/Next/Upcoming stops
- **Stop details** with:
  - Significance and preference fit
  - Timing information
  - Citations and sources
  - Official website links
  - Audio narration (Web Speech API)
  - Navigate to location

### Review & Reconfigure
- "Looks Good" approval flow
- "Something Missing" feedback mechanism
- Reconfigure current plan
- Generate new plan with updated preferences

### PWA Features
- Installable on mobile and desktop
- Offline-capable service worker
- Responsive design (mobile-first)
- Dark mode support
- Local data persistence

## Tech Stack

- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Vite** for build tooling
- **Lucide React** for icons
- **Web APIs**: Geolocation, Speech Synthesis
- **PWA**: Service Worker, manifest

## Project Structure

```
src/
├── components/
│   ├── TripSetup.tsx          # Trip configuration form
│   ├── PreferencesSetup.tsx   # Interests & preferences
│   ├── PlanGenerating.tsx     # Loading state
│   ├── PlanView.tsx           # Main plan view
│   ├── MapView.tsx            # Map with stops
│   ├── Timeline.tsx           # Now/Next timeline
│   ├── StopPopup.tsx          # Stop details modal
│   └── Header.tsx             # App header
├── context/
│   └── AppContext.tsx         # Global state management
├── types/
│   └── index.ts               # TypeScript definitions
├── styles/
│   └── colors.ts              # Design tokens
├── utils/
│   └── pwa.ts                 # PWA utilities
├── App.tsx                    # Main app component
└── main.tsx                   # Entry point
```

## Design System

The app uses a comprehensive color system with light and dark theme support:
- Primary: Blue tones
- Secondary: Orange tones
- Accent: Green tones
- Route colors: Walking (green), Transit (blue), Driving (orange)

## User Flow

1. **Trip Setup** → Enter city, dates, accommodation, transport preferences
2. **Preferences** → Prioritize interests, set budget, dining preferences
3. **Generation** → AI creates optimized itinerary (3s simulation)
4. **Review** → Approve or provide feedback
5. **Navigate** → Follow live plan with real-time location

## Responsive Design

- **Mobile**: Full-screen map with draggable bottom sheet timeline
- **Desktop**: Split view with map on left, timeline on right
- **Tablet**: Adaptive layout with appropriate breakpoints

## Key Features by Screen

### Mobile
- Touch-optimized controls
- Swipeable bottom sheet
- Full-screen modals
- Sticky action bar

### Desktop
- Side-by-side map and timeline
- Right-rail actions
- Hover states and transitions
- Keyboard navigation

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Future Enhancements

- Real Google Maps integration
- Backend API for plan generation
- User accounts and plan history
- Social sharing
- Offline plan caching
- Push notifications
- Multi-day trip support
- Weather API integration
- Real-time traffic updates

## Browser Support

- Chrome/Edge (latest)
- Safari (iOS 13+, macOS)
- Firefox (latest)
- PWA installable on all platforms

## Accessibility

- WCAG 2.1 AA compliant
- Keyboard navigation
- Screen reader support
- Color contrast ratios
- Focus management
- ARIA labels

## License

MIT
