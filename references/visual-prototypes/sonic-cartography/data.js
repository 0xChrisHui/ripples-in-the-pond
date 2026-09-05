const TITLES = [
  [
    'Before the Rain','Slow Meridian','A Stone Remembers','Low Tide Signal','Moss Radio','Outer Bank',
    'Aperture of Blue','Quiet Current','The Long Reed','Minor Estuary','Silt and Silver','Near Water',
    'North of Stillness','Unlit Ferry','Soft Coordinates','Weathered Bell','Pale Tributary','First Reflection',
    'Borrowed Shore','Contour for Two','A Place to Listen','Drift Index','Open Channel','The Reed Archive',
    'Floodplain Study','Distant Oar','A Map of Breathing','Sediment Song','Nocturne in Silt','Red Buoy',
    'Shallow Memory','River Without Name','Measured Rain','Bank at Dusk','Surface Tension','After the Ripple'
  ],
  [
    'Understory I','Blackwater Letter','Sunken Frequency','Pressure Garden','Second Current','Beneath the Marker',
    'Submerged Room','Dark Reed','Sounding Line','Mineral Sleep','Abyssal Postcard','The Listening Well',
    'Midwater Bloom','Signal in Clay','Tidal Grammar','Lower Register','Hollow Coordinate','Night Sediment',
    'Slow Descent','Understory II','The Weight of Blue','Archive of Depth','Sonic Core','Faint Thermocline',
    'Unseen Confluence','Deep Field Notes','Pressure Bell','An Inland Sea','Drowned Measure','Cold Meridian',
    'Below All Names','Silt Memory II','Dark Estuary','The Third Bank','Residual Current','Floor of the Pond'
  ],
  [
    'Afterimage I','Return Current','Trace of a Hand','Red Latitude','Memory Delta','A Future Shore',
    'The Last Sounding','Echo Cartography','Dry River Signal','Residual Bloom','Another Weather','Postscript in Water',
    'Contour of Absence','The Unfinished Map','Field Recording 73','Folding Estuary','Remembered Rain','Ghost Buoy',
    'A Line Returning','Afterimage II','Distant Playback','Sonic Palimpsest','The Map Listens','Warm Coordinates',
    'Archive at Dawn','Frequency Orchard','Last Tributary','A Ripple Kept','Unwritten Bank','Open Memory',
    'Re-entry','The Pond Replies','Index of Echoes','Small Red Signal','Confluence 107','Where Water Ends'
  ]
];

export const CHAPTERS = [
  { name:'SURFACE / 表层', range:'001—036', depth:'01' },
  { name:'DEPTH / 深层', range:'037—072', depth:'02' },
  { name:'AFTERIMAGE / 余像', range:'073—108', depth:'03' }
];

// 26 组图形语法共享一种视觉物种，但结构、方向和节奏各不相同。
export const GRAMMARS = Array.from({ length:26 }, (_, index) => ({
  type:index % 13,
  sides:3 + (index % 7),
  echoes:1 + (index % 4),
  rotation:(index * 0.37) % Math.PI,
  dash:index % 3 === 0 ? 6 + index % 5 : 0,
  frequency:9 + (index % 6) * 2,
  direction:index % 2 ? 1 : -1
}));

export const TUNING_DEFAULTS = {
  density:7, warp:0.38, speed:0.11, decay:5, ink:0.2, nodeScale:1
};

export const PRESETS = {
  archive:{ density:8, warp:0.22, speed:0.08, decay:3.5, ink:0.24, nodeScale:0.9 },
  performance:{ density:6, warp:0.52, speed:0.14, decay:4.5, ink:0.18, nodeScale:1.15 },
  afterimage:{ density:9, warp:0.66, speed:0.06, decay:7, ink:0.12, nodeScale:0.85 }
};

function noise(seed) {
  const value = Math.sin(seed * 91.723 + 17.11) * 43758.5453;
  return value - Math.floor(value);
}

export function makeTracks(chapter) {
  return TITLES[chapter].map((title, index) => {
    const col = index % 6;
    const row = Math.floor(index / 6);
    const number = chapter * 36 + index + 1;
    const x = 0.08 + col * 0.168 + (noise(number) - 0.5) * 0.055;
    const y = 0.09 + row * 0.164 + (noise(number + 8) - 0.5) * 0.06;
    return {
      id:`track-${number}`,
      number,
      label:String(number).padStart(3, '0'),
      title,
      duration:34 + Math.floor(noise(number + 21) * 20),
      x:Math.max(0.055, Math.min(0.945, x)),
      y:Math.max(0.06, Math.min(0.94, y)),
      coordinate:`${(x * 180 - 90).toFixed(1)} / ${(y * 90 - 45).toFixed(1)}`
    };
  });
}

export function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
