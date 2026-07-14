// ค่าคงที่ส่วนกลางของ dashboard
const CONFIG = {
  MAP_CENTER: [13.984382, 100.555301],
  MAP_ZOOM: 15,
  TILE_ATTRIBUTION: '&copy; OpenStreetMap &copy; CARTO',

  // palette แยกตามธีม (ตรงกับ CSS variables ใน style.css)
  THEMES: {
    dark: {
      s1: '#3987e5', s2: '#199e70', s3: '#c98500', s5: '#9085e9',
      good: '#0ca30c', warn: '#fab219', serious: '#ec835a', crit: '#d03b3b',
      ink: '#ffffff', ink2: '#c3c2b7', muted: '#898781',
      grid: '#2c2c2a', surface: '#1a1a19', surface2: '#222221',
      tooltipBg: '#222221', tooltipBorder: 'rgba(255,255,255,0.12)',
      tileUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    },
    light: {
      s1: '#2a78d6', s2: '#1baf7a', s3: '#eda100', s5: '#4a3aa7',
      good: '#0ca30c', warn: '#fab219', serious: '#ec835a', crit: '#d03b3b',
      ink: '#0b0b0b', ink2: '#4a4946', muted: '#7a7872',
      grid: '#d6d4cb', surface: '#fdfdfb', surface2: '#f1efe7',
      tooltipBg: '#ffffff', tooltipBorder: 'rgba(11,11,11,0.15)',
      tileUrl: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    }
  },

  COLORS: null, // ชี้ไปยัง palette ของธีมปัจจุบัน — ตั้งค่าโดย applyTheme()

  // สถานะอุปกรณ์/เซนเซอร์ (textColor = สีข้อความแบบ theme-aware สำหรับสีที่อ่านยากบนพื้นสว่าง)
  STATUS: {
    normal:   { label: 'ปกติ',      color: '#0ca30c', badge: 'badge-good' },
    warning:  { label: 'เฝ้าระวัง', color: '#fab219', badge: 'badge-warn', textColor: 'var(--warn-text)' },
    critical: { label: 'วิกฤต',     color: '#d03b3b', badge: 'badge-crit' },
    fault:    { label: 'ขัดข้อง',   color: '#d03b3b', badge: 'badge-crit' },
    running:  { label: 'ทำงาน',     color: '#0ca30c', badge: 'badge-good' },
    standby:  { label: 'สแตนด์บาย', color: '#898781', badge: 'badge-info' },
    online:   { label: 'ออนไลน์',   color: '#0ca30c', badge: 'badge-good' },
    offline:  { label: 'ออฟไลน์',   color: '#d03b3b', badge: 'badge-crit' }
  },

  // ระดับความเสี่ยงน้ำท่วม (AI)
  RISK: {
    low:      { label: 'เสี่ยงต่ำ',     color: '#0ca30c', badge: 'badge-good' },
    moderate: { label: 'เสี่ยงปานกลาง', color: '#fab219', badge: 'badge-warn', textColor: 'var(--warn-text)' },
    high:     { label: 'เสี่ยงสูง',     color: '#d03b3b', badge: 'badge-crit' }
  },

  // ความรุนแรงของ anomaly
  SEVERITY: {
    critical: { label: 'วิกฤต',     color: '#d03b3b', badge: 'badge-crit' },
    serious:  { label: 'รุนแรง',    color: '#ec835a', badge: 'badge-serious' },
    warning:  { label: 'เฝ้าระวัง', color: '#fab219', badge: 'badge-warn', textColor: 'var(--warn-text)' },
    info:     { label: 'ทั่วไป',    color: '#898781', badge: 'badge-info' }
  },

  BILL_STATUS: {
    paid:    { label: 'ชำระแล้ว',   badge: 'badge-good' },
    pending: { label: 'รอชำระ',     badge: 'badge-warn' },
    overdue: { label: 'ค้างชำระ',   badge: 'badge-crit' }
  },

  // ระดับการให้บริการจราจร (Level of Service — ย่อจาก LOS A-F)
  LOS: {
    free:  { label: 'คล่องตัว',   color: '#0ca30c', badge: 'badge-good' },
    busy:  { label: 'ชะลอตัว',    color: '#fab219', badge: 'badge-warn', textColor: 'var(--warn-text)' },
    heavy: { label: 'หนาแน่น',    color: '#ec835a', badge: 'badge-serious' },
    jam:   { label: 'ติดขัดหนัก', color: '#d03b3b', badge: 'badge-crit' }
  },

  // สถานะรถที่ระบบติดตาม (GPS / LPR)
  VEHICLE_STATUS: {
    normal: { label: 'ปกติ',          color: '#0ca30c', badge: 'badge-good' },
    watch:  { label: 'เฝ้าติดตาม',    color: '#fab219', badge: 'badge-warn', textColor: 'var(--warn-text)' },
    alert:  { label: 'แจ้งเตือนด่วน', color: '#d03b3b', badge: 'badge-crit' }
  },

  SENSOR_TYPE: {
    water_quality: 'คุณภาพน้ำ',
    water_level: 'ระดับน้ำ',
    combined: 'คุณภาพ + ระดับน้ำ'
  }
};

// สลับ palette ของ JS/Chart.js ให้ตรงกับธีมปัจจุบัน (CSS สลับเองผ่าน data-theme)
function applyTheme(themeName) {
  CONFIG.COLORS = CONFIG.THEMES[themeName] || CONFIG.THEMES.dark;
  const C = CONFIG.COLORS;
  if (window.Chart) {
    Chart.defaults.color = C.ink2;
    Chart.defaults.borderColor = C.grid;
    Chart.defaults.font.family = '"Noto Sans Thai", system-ui, "Segoe UI", sans-serif';
    Chart.defaults.font.size = 11;
    Chart.defaults.plugins.tooltip.backgroundColor = C.tooltipBg;
    Chart.defaults.plugins.tooltip.titleColor = C.ink;
    Chart.defaults.plugins.tooltip.bodyColor = C.ink2;
    Chart.defaults.plugins.tooltip.borderColor = C.tooltipBorder;
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
  }
}

// ตั้งค่าเริ่มต้นตามธีมที่เลือกไว้ (data-theme ถูกตั้งจาก inline script ใน index.html)
applyTheme(document.documentElement.dataset.theme);
