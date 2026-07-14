// ===== ส่วนกลางของหน้าสไลด์นำเสนอ (16:9) =====
// จัดการ: ย่อ/ขยาย stage ให้พอดีจอ, แถบนำทางระหว่างสไลด์, แผนที่แบบนิ่ง,
// ชิ้นส่วน infographic (stat tile / หัวการ์ด / ไอคอน) และกราฟ SVG ขนาดใหญ่
// (ใช้ SVG แทน Chart.js เพื่อให้คมชัดเมื่อ stage ถูก scale)

const Slide = {
  STAGE_W: 1920,
  STAGE_H: 1080,

  // ย่อ/ขยาย stage ให้พอดีหน้าจอโดยคงสัดส่วน 16:9
  fitStage() {
    const stage = document.getElementById('stage');
    const fit = () => {
      const s = Math.min(innerWidth / this.STAGE_W, innerHeight / this.STAGE_H);
      // translate(-50%,-50%) จัดกึ่งกลางก่อน แล้ว scale จากจุดกึ่งกลาง (ดู slide.css)
      stage.style.transform = `translate(-50%, -50%) scale(${s.toFixed(4)})`;
    };
    fit();
    addEventListener('resize', fit);
  },

  // แถบนำทางลอยมุมจอ (นอก stage — โปร่งจนกว่าจะ hover จึงไม่ติดใน capture)
  // + ลูกศรซ้าย/ขวาเปลี่ยนสไลด์ + ปุ่มสลับธีม
  PAGES: [
    { file: 'slide-water.html', label: '1', title: 'Smart Water' },
    { file: 'slide-flood.html', label: '2', title: 'Smart Flood Alert' },
    { file: 'slide-traffic.html', label: '3', title: 'Smart Traffic' }
  ],

  initNav(current, backHref) {
    const nav = document.createElement('nav');
    nav.className = 'slide-nav';
    nav.innerHTML = `
      <a class="slide-nav-btn" href="${backHref}" title="กลับหน้าแดชบอร์ด">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>
        </svg>
      </a>
      ${this.PAGES.map((p, i) => `
        <a class="slide-nav-btn ${i === current ? 'active' : ''}" href="${p.file}" title="${p.title}">${p.label}</a>
      `).join('')}
      <button class="slide-nav-btn" id="slide-theme-btn" title="สลับธีม มืด/สว่าง">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
        </svg>
      </button>`;
    document.body.appendChild(nav);

    // สลับธีมผ่าน ?theme= แล้วโหลดใหม่ (สไลด์วาดครั้งเดียว ไม่มีระบบ re-render
    // และค่าเริ่มต้นของหน้าสไลด์คือธีมสว่างพื้นขาว ไม่ผูกกับ localStorage)
    document.getElementById('slide-theme-btn').addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      const q = new URLSearchParams(location.search);
      q.set('theme', next);
      location.search = q.toString();
    });

    // ลูกศรซ้าย/ขวา = สไลด์ก่อนหน้า/ถัดไป (คงธีมปัจจุบันไว้)
    const keepTheme = (file) =>
      file + (location.search.includes('theme=') ? location.search : '');
    addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' && current < this.PAGES.length - 1)
        location.href = keepTheme(this.PAGES[current + 1].file);
      if (e.key === 'ArrowLeft' && current > 0)
        location.href = keepTheme(this.PAGES[current - 1].file);
    });
  },

  // แผนที่บนสไลด์ — ลาก/ซูม/คลิกหมุดดูรายละเอียดได้ (Leaflet 1.9 รองรับ container
  // ที่ถูก scale ด้วย transform อยู่แล้ว) แต่ไม่มีปุ่มซูมเพื่อไม่ให้ติดใน capture
  staticMap(elId) {
    const C = CONFIG.COLORS;
    const map = L.map(elId, {
      zoomControl: false, keyboard: false, zoomSnap: 0.25
    });
    L.tileLayer(C.tileUrl, { maxZoom: 19, attribution: CONFIG.TILE_ATTRIBUTION }).addTo(map);
    return map;
  },

  // ผูก popup รายละเอียดกับ marker / polygon / เส้น (เปิดเมื่อคลิก)
  popup(layer, html, w = 280) {
    layer.bindPopup(html, { maxWidth: w });
    return layer;
  },

  // แถวข้อมูล label:ค่า ใช้ประกอบเนื้อหาใน popup
  kv(label, value) {
    return `<div style="display:flex;justify-content:space-between;gap:14px;line-height:1.7">
      <span style="color:var(--muted)">${label}</span>
      <span style="font-weight:600;color:var(--ink);text-align:right">${value}</span>
    </div>`;
  },

  // หมุดวงกลมสถานะ (ใช้ร่วมทุกสไลด์)
  dotMarker(map, lat, lng, color, r = 8, critical = false) {
    return L.circleMarker([lat, lng], {
      radius: r, color, weight: 2.5, fillColor: color, fillOpacity: 0.55,
      className: critical ? 'marker-critical' : ''
    }).addTo(map);
  },

  // ป้ายชื่อกำกับหมุด (tooltip ถาวรแบบ zone-label)
  label(marker, text, dir = 'top', offsetY = -8) {
    marker.bindTooltip(text, {
      permanent: true, direction: dir, offset: [0, offsetY], className: 'zone-label'
    });
  },

  // ไอคอน stroke ขนาดเล็กสำหรับ stat tile / หัวการ์ด
  icon(name, size = 18) {
    const paths = {
      droplet: '<path d="M12 2.7 6.6 9.5a6.5 6.5 0 1 0 10.8 0Z"/>',
      wave: '<path d="M2 6c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2M2 12c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2M2 18c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2"/>',
      factory: '<path d="M2 20V9l6 4V9l6 4V4h6v16Z"/><path d="M17 8h2M17 12h2M17 16h2"/>',
      alert: '<path d="m10.3 3.8-8 13.8A2 2 0 0 0 4 20.6h16a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
      gauge: '<path d="M12 15 8.5 9.2"/><path d="M20.2 17.5a9 9 0 1 0-16.4 0"/>',
      rain: '<path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.4 8.3"/><path d="M8 19v2M12 18v3M16 19v2"/>',
      bolt: '<path d="M13 2 3 14h7l-1 8 12-13h-8l1-7Z"/>',
      pump: '<circle cx="12" cy="13" r="7"/><path d="M12 13 15.5 9.5M9 3h6M12 3v3"/>',
      users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
      truck: '<path d="M14 16.5V19a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2.5"/><path d="M5.5 11 7 6.6A2 2 0 0 1 8.9 5.3h6.2A2 2 0 0 1 17 6.6L18.5 11"/><path d="M4 11h16a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V12a1 1 0 0 1 1-1Z"/><path d="M6.5 13.8h.01M17.5 13.8h.01"/>',
      camera: '<path d="M2 8.5 16 5l1 4.5L3.5 13Z"/><path d="M17 9.3 21 8v6l-3.5-1.2M6 13.5V19h4"/>',
      radio: '<circle cx="12" cy="12" r="2"/><path d="M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>',
      timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
      shield: '<path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
      signal: '<path d="M9 3h6v18H9Z"/><circle cx="12" cy="7" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="17" r="1.4"/>',
      map: '<path d="m9 3-6 2v16l6-2 6 2 6-2V3l-6 2-6-2Z"/><path d="M9 3v16M15 5v16"/>',
      cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>'
    };
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ''}</svg>`;
  },

  // stat tile ใหญ่แบบ infographic: ไอคอน + ป้าย / ตัวเลขเด่น + บริบท / mini chart ขวา
  stat(t) {
    return `
      <div class="slide-card p-5 flex flex-col gap-3 ${t.span || ''}">
        <div class="flex items-center gap-2.5">
          <span class="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                style="background:${t.color}1f;color:${t.color}">${this.icon(t.icon)}</span>
          <span class="text-[14.5px] font-medium text-ink2 leading-tight">${t.label}</span>
        </div>
        <div class="flex items-end justify-between gap-3 flex-1 min-h-0">
          <div class="min-w-0">
            <div class="flex items-baseline gap-1.5">
              <span class="${t.small ? 'text-[30px]' : 'text-[42px]'} font-bold leading-none tabular-nums tracking-tight"
                    style="color:${t.valueColor || 'var(--ink)'}">${t.value}</span>
              ${t.unit ? `<span class="text-[14px] text-muted">${t.unit}</span>` : ''}
            </div>
            <div class="text-[12.5px] text-muted mt-2 leading-snug">${t.sub || ''}</div>
          </div>
          ${t.chart ? `<div class="shrink-0 ${t.chartClass || 'w-[140px] h-[56px]'}">${t.chart}</div>` : ''}
        </div>
      </div>`;
  },

  // หัวการ์ดสไลด์: แถบสีนำสายตา + ชื่อ + คำอธิบาย + ส่วนขวา (ชิป/ป้าย)
  head(title, sub, right = '', color = 'var(--s1)') {
    return `
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-3 min-w-0">
          <span class="w-1.5 self-stretch rounded-full shrink-0" style="background:${color}"></span>
          <div class="min-w-0">
            <div class="slide-sec-title">${title}</div>
            ${sub ? `<div class="slide-sec-sub mt-0.5">${sub}</div>` : ''}
          </div>
        </div>
        ${right ? `<div class="shrink-0">${right}</div>` : ''}
      </div>`;
  },

  // ชิปข้อมูลเล็ก (ใช้ใน legend / มุมการ์ด)
  chip(text, color) {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-line/10 bg-surface2
      px-2.5 py-1 text-[11.5px] text-ink2 whitespace-nowrap">
      ${color ? `<span class="dot" style="background:${color};width:7px;height:7px"></span>` : ''}${text}</span>`;
  },

  // legend รายการสี (แนวตั้ง ใช้บนแผนที่)
  legend(items) {
    return items.map(i => `
      <div class="flex items-center gap-2 text-[11.5px] text-ink2 whitespace-nowrap">
        <span class="dot" style="background:${i.color};width:8px;height:8px"></span>${i.label}
      </div>`).join('');
  },

  // แถบหัวสไลด์: โลโก้สี + ชื่อระบบ + คำอธิบาย / ขวาเป็นชิปบริบท (วันที่ ฯลฯ)
  header(o) {
    return `
      <div class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
           style="background:${o.color}1f;border:1px solid ${o.color}55;color:${o.color}">
        ${this.icon(o.icon, 26)}
      </div>
      <div class="min-w-0">
        <div class="flex items-baseline gap-3">
          <h1 class="text-[30px] font-bold leading-tight tracking-tight">${o.title}</h1>
          <span class="text-[15px] font-medium" style="color:${o.color}">${o.tag || ''}</span>
        </div>
        <p class="text-[14px] text-muted leading-tight mt-0.5">${o.sub}</p>
      </div>
      <div class="flex-1"></div>
      <div class="flex items-center gap-2.5 shrink-0">${o.right || ''}</div>`;
  }
};

// ===== กราฟ SVG ขนาดใหญ่สำหรับสไลด์ (คมชัดทุกระดับ scale) =====
const SlideCharts = {
  _uid: 0,

  // แท่งปลายมนบนเท่านั้น (ฐานเรียบชิด baseline ตาม mark spec)
  _barPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y}
      L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
  },

  // กราฟเส้น: หลาย series (รองรับ offset เริ่ม เช่น เส้นคาดการณ์ต่อท้ายค่าจริง)
  // + เส้นเกณฑ์แนวนอน (threshold) + grid/แกนแบบ recessive
  line(cfg) {
    const w = cfg.w ?? 800, h = cfg.h ?? 300;
    const padL = 46, padR = 20, padT = 18, padB = 30;
    const n = cfg.labels.length;
    const vals = cfg.series.flatMap(s => s.data);
    if (cfg.threshold) vals.push(cfg.threshold.value);
    let min = Math.min(...vals), max = Math.max(...vals);
    const rng = (max - min) || 1;
    min -= rng * 0.15; max += rng * 0.18;
    const X = i => padL + i * (w - padL - padR) / (n - 1);
    const Y = v => padT + (max - v) / (max - min) * (h - padT - padB);
    const dg = cfg.yDigits ?? 1;

    let out = '';
    for (let t = 0; t <= 4; t++) {
      const v = min + (max - min) * t / 4, y = Y(v);
      out += `<line x1="${padL}" x2="${w - padR}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--grid)" stroke-width="1"/>
        <text x="${padL - 9}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--muted)">${v.toFixed(dg)}</text>`;
    }
    const step = Math.max(1, Math.ceil(n / (cfg.xTicks ?? 8)));
    cfg.labels.forEach((lb, i) => {
      if (i % step === 0 || i === n - 1)
        out += `<text x="${X(i).toFixed(1)}" y="${h - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${lb}</text>`;
    });

    let defs = '';
    cfg.series.forEach(s => {
      const start = s.start ?? 0;
      const pts = s.data.map((v, i) => [X(start + i), Y(v)]);
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
      if (s.area) {
        const id = 'slg' + (++this._uid);
        defs += `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${s.color}" stop-opacity=".2"/>
          <stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`;
        out += `<path d="${d} L${pts[pts.length - 1][0].toFixed(1)},${Y(min).toFixed(1)}
          L${pts[0][0].toFixed(1)},${Y(min).toFixed(1)} Z" fill="url(#${id})"/>`;
      }
      out += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5"
        ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linecap="round" stroke-linejoin="round"/>`;
      const [lx, ly] = pts[pts.length - 1];
      out += `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`;
      if (s.endLabel) out += `<text x="${(lx - 2).toFixed(1)}" y="${(ly - 11).toFixed(1)}" text-anchor="end"
        font-size="12" font-weight="600" fill="var(--ink)">${s.endLabel}</text>`;
    });

    if (cfg.threshold) {
      const y = Y(cfg.threshold.value);
      out += `<line x1="${padL}" x2="${w - padR}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"
          stroke="var(--crit)" stroke-width="1.5" stroke-dasharray="7 5"/>
        <text x="${padL + 6}" y="${(y - 6).toFixed(1)}" text-anchor="start" font-size="11.5"
          font-weight="500" fill="var(--crit)">${cfg.threshold.label}</text>`;
    }
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%"><defs>${defs}</defs>${out}</svg>`;
  },

  // กราฟแท่งแนวตั้ง + เส้นความจุ (dashed) — สีรายแท่งกำหนดผ่าน colorFn
  bars(cfg) {
    const w = cfg.w ?? 420, h = cfg.h ?? 220;
    const padL = 42, padR = 12, padT = 16, padB = 26;
    const n = cfg.values.length, gap = 6;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const bw = (plotW - gap * (n - 1)) / n;
    const max = Math.max(...cfg.values, cfg.capacity || 0) * 1.12 || 1;
    const Y = v => padT + (1 - v / max) * plotH;

    let out = '';
    for (let t = 0; t <= 3; t++) {
      const v = max * t / 3, y = Y(v);
      out += `<line x1="${padL}" x2="${w - padR}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--grid)" stroke-width="1"/>
        <text x="${padL - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="10.5" fill="var(--muted)">${Utils.compact(Math.round(v))}</text>`;
    }
    cfg.values.forEach((v, i) => {
      const x = padL + i * (bw + gap), bh = Math.max(3, v / max * plotH);
      const c = cfg.colorFn ? cfg.colorFn(v, i) : cfg.color;
      out += `<path d="${this._barPath(x, h - padB - bh, bw, bh, 4)}" fill="${c}" opacity="${cfg.colorFn ? 1 : (i === n - 1 ? 1 : 0.55)}"/>`;
      if (i % (cfg.labelStep ?? 2) === 0)
        out += `<text x="${(x + bw / 2).toFixed(1)}" y="${h - 7}" text-anchor="middle" font-size="10.5" fill="var(--muted)">${cfg.labels[i]}</text>`;
    });
    if (cfg.capacity) {
      const y = Y(cfg.capacity);
      out += `<line x1="${padL}" x2="${w - padR}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"
          stroke="var(--serious)" stroke-width="1.5" stroke-dasharray="6 5"/>
        <text x="${w - padR}" y="${(y - 5).toFixed(1)}" text-anchor="end" font-size="10.5" fill="var(--serious)">${cfg.capacityLabel || 'ความจุ'}</text>`;
    }
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%">${out}</svg>`;
  },

  // โดนัทสัดส่วน + ตัวเลขรวมกลางวง (คั่นแต่ละส่วนด้วยช่องว่างตาม mark spec)
  donut(items, o = {}) {
    const size = o.size ?? 150, sw = o.thick ?? 20;
    const r = (size - sw) / 2, cx = size / 2, cy = size / 2;
    const C = 2 * Math.PI * r;
    const total = items.reduce((s, i) => s + i.value, 0) || 1;
    const gapPx = items.filter(i => i.value > 0).length > 1 ? 3 : 0;
    let acc = 0, segs = '';
    items.forEach(i => {
      if (!i.value) return;
      const len = i.value / total * C;
      segs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${i.color}" stroke-width="${sw}"
        stroke-dasharray="${Math.max(1, len - gapPx).toFixed(1)} ${(C - len + gapPx).toFixed(1)}"
        stroke-dashoffset="${(-acc).toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`;
      acc += len;
    });
    return `
      <div class="relative shrink-0" style="width:${size}px;height:${size}px">
        <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${segs}</svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span class="text-[30px] font-bold tabular-nums">${o.centerValue ?? total}</span>
          <span class="text-[11px] text-muted mt-1">${o.centerLabel || ''}</span>
        </div>
      </div>`;
  },

  // เกจครึ่งวงกลมใหญ่ (ดัชนี 0-max) + ตัวเลขกลาง
  gauge(value, max, color, o = {}) {
    const w = o.w ?? 230, sw = o.thick ?? 20;
    const r = (w - sw) / 2 - 2, cx = w / 2, cy = w / 2 + 6, h = cy + sw / 2;
    const f = Math.max(0.02, Math.min(1, value / max));
    const ang = Math.PI * (1 - f);
    const px = cx + r * Math.cos(ang), py = cy - r * Math.sin(ang);
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%">
      <path d="M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}" fill="none"
        stroke="var(--grid)" stroke-width="${sw}" stroke-linecap="round"/>
      <path d="M${cx - r},${cy} A${r},${r} 0 0 1 ${px.toFixed(1)},${py.toFixed(1)}" fill="none"
        stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>
      <text x="${cx}" y="${cy - 26}" text-anchor="middle" font-size="46" font-weight="700"
        fill="var(--ink)">${value}</text>
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="13" fill="var(--muted)">${o.label || `จากเต็ม ${max}`}</text>
    </svg>`;
  },

  // แถบอันดับแนวนอน (ranking) — HTML ล้วน อ่านง่ายบนสไลด์
  hbars(items, o = {}) {
    const max = Math.max(...items.map(i => i.value)) || 1;
    return items.map((it, idx) => `
      <div class="flex items-center gap-3">
        <span class="w-6 text-[13px] font-semibold text-muted tabular-nums text-right shrink-0">${idx + 1}</span>
        <div class="flex-1 min-w-0">
          <div class="flex items-baseline justify-between gap-2 mb-1">
            <span class="text-[13px] text-ink truncate">${it.label}</span>
            <span class="text-[13px] font-semibold tabular-nums shrink-0">${it.valueLabel}</span>
          </div>
          <div class="meter" style="height:8px">
            <span style="width:${(it.value / max * 100).toFixed(1)}%;background:${it.color || 'var(--s1)'}"></span>
          </div>
          ${it.sub ? `<div class="text-[11px] text-muted mt-0.5">${it.sub}</div>` : ''}
        </div>
      </div>`).join('');
  }
};
