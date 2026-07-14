// Spark — mini chart (inline SVG) สำหรับ KPI tile / แบนเนอร์ ทุกหน้า
// มี 4 แบบ: line (เส้น+พื้นที่ไล่จาง), bars (แท่งจิ๋ว), dots (dot-matrix), gauge (ครึ่งวงกลม)
// + delta() ป้ายเทียบช่วงก่อนหน้า (ลูกศรขึ้น/ลง + %)
const Spark = {
  _uid: 0,

  // เส้นแนวโน้ม + พื้นที่ไล่เฉดใต้เส้น + จุดปลายเส้น
  line(data, color, o = {}) {
    const w = o.w ?? 100, h = o.h ?? 38, p = 4;
    const min = Math.min(...data), max = Math.max(...data), rng = (max - min) || 1;
    const pts = data.map((v, i) => [
      p + i * (w - 2 * p) / (data.length - 1),
      h - p - (v - min) / rng * (h - 2 * p)
    ]);
    const path = pts.map((pt, i) => (i ? 'L' : 'M') + pt[0].toFixed(1) + ',' + pt[1].toFixed(1)).join(' ');
    const [lx, ly] = pts[pts.length - 1];
    const id = 'spk' + (++this._uid);
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity=".26"/>
        <stop offset="1" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${path} L${lx.toFixed(1)},${h - p} L${pts[0][0].toFixed(1)},${h - p} Z" fill="url(#${id})"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.7" fill="${color}" stroke="var(--surface)" stroke-width="1.5"/>
    </svg>`;
  },

  // แท่งจิ๋วปลายมน — แท่งที่ highlight เข้มสุด แท่งอื่นโปร่ง (สีเดี่ยวหรือกำหนดรายแท่งผ่าน o.colors)
  bars(data, color, o = {}) {
    const w = o.w ?? 100, h = o.h ?? 38, gap = 2.5;
    const n = data.length, bw = (w - gap * (n - 1)) / n;
    const max = Math.max(...data) || 1;
    const hi = o.highlight ?? data.indexOf(Math.max(...data));
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%">
      ${data.map((v, i) => {
        const bh = Math.max(2.5, v / max * (h - 3));
        const c = o.colors ? o.colors[i] : color;
        return `<rect x="${(i * (bw + gap)).toFixed(1)}" y="${(h - bh).toFixed(1)}"
          width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${Math.min(2.5, bw / 2.5).toFixed(1)}"
          fill="${c}" opacity="${o.colors ? 1 : (i === hi ? 1 : 0.38)}"/>`;
      }).join('')}
    </svg>`;
  },

  // dot-matrix: คอลัมน์ละ 1-4 จุดตามค่า — คอลัมน์ค่าสูงสุดสีเข้ม (สไตล์ Transactions/Customers)
  dots(data, color, o = {}) {
    const rows = o.rows ?? 4, cell = 7.2, r = 2.5;
    const w = data.length * cell, h = rows * cell;
    const max = Math.max(...data) || 1;
    const hi = data.indexOf(Math.max(...data));
    let out = '';
    data.forEach((v, i) => {
      const cnt = Math.max(1, Math.round(v / max * rows));
      for (let j = 0; j < cnt; j++) {
        out += `<circle cx="${(i * cell + cell / 2).toFixed(1)}" cy="${(h - j * cell - cell / 2).toFixed(1)}"
          r="${r}" fill="${color}" opacity="${i === hi ? 1 : 0.42}"/>`;
      }
    });
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%">${out}</svg>`;
  },

  // เกจครึ่งวงกลม 0-100%
  gauge(pct, color, o = {}) {
    const w = o.w ?? 92, h = o.h ?? 50, sw = 8;
    const r = (w - sw) / 2 - 2, cx = w / 2, cy = h - 6;
    const f = Math.max(0.02, Math.min(1, pct / 100));
    // จุดปลายส่วนโค้งที่สัดส่วน f (มุมกวาดจากซ้าย 180° → ขวา 0°)
    const ang = Math.PI * (1 - f);
    const px = cx + r * Math.cos(ang), py = cy - r * Math.sin(ang);
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%">
      <path d="M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}" fill="none"
            stroke="var(--grid)" stroke-width="${sw}" stroke-linecap="round"/>
      <path d="M${cx - r},${cy} A${r},${r} 0 0 1 ${px.toFixed(1)},${py.toFixed(1)}" fill="none"
            stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>
      <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="13" font-weight="600"
            fill="var(--ink)">${Math.round(pct)}%</text>
    </svg>`;
  },

  // ป้าย delta เทียบช่วงก่อนหน้า: dir 'good'|'bad'|'neutral' (สีเขียว/แดง/เทา)
  delta(pct, label, dir = 'neutral') {
    const C = CONFIG.COLORS;
    const up = pct >= 0;
    const color = dir === 'good' ? C.good : dir === 'bad' ? C.crit : 'var(--muted)';
    return `<span class="inline-flex items-center gap-1 text-[10px] font-medium" style="color:${color}">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
        ${up ? '<path d="M7 17 17 7M8.5 7H17v8.5"/>' : '<path d="M7 7l10 10M17 8.5V17H8.5"/>'}
      </svg>${Math.abs(pct).toFixed(1).replace(/\.0$/, '')}%
      <span class="font-normal" style="color:var(--muted)">${label}</span>
    </span>`;
  },

  // ชิปป้ายพีค เช่น "พีค: 08:00"
  chip(text) {
    return `<span class="rounded-full bg-surface2 border border-line/10 px-2 py-0.5 text-[9.5px] text-ink2 whitespace-nowrap">${text}</span>`;
  },

  // โครง KPI tile มาตรฐาน: หัวข้อ+ชิป / ตัวเลขใหญ่+delta ซ้าย / mini chart ขวา
  // t.big = การ์ดเด่น (ตัวเลข/กราฟใหญ่ขึ้น) · t.span = คลาสจัดวางบน grid (เช่น 'col-span-2')
  tile(t) {
    const valueSize = t.big
      ? (t.small ? 'text-2xl' : 'text-4xl')
      : (t.small ? 'text-base' : 'text-[22px]');
    const chartBox = t.chartClass || (t.big ? 'w-[190px] h-[60px]' : 'w-[96px] h-[38px]');
    return `
      <div class="card ${t.big ? 'p-4' : 'p-3.5'} flex flex-col ${t.span || ''}">
        <div class="flex items-start justify-between gap-2 ${t.big ? 'mb-2.5' : 'mb-1.5'}">
          <span class="${t.big ? 'text-[11.5px] font-medium text-ink2' : 'text-[10.5px] text-muted'} leading-tight">${t.label}</span>
          ${t.chip ? this.chip(t.chip) : ''}
        </div>
        <div class="flex items-end justify-between gap-3 flex-1">
          <div class="min-w-0">
            <div class="flex items-baseline gap-1">
              <span class="${valueSize} font-semibold leading-none tabular-nums"
                    style="color:${t.color || 'var(--ink)'}">${t.value}</span>
              ${t.unit ? `<span class="${t.big ? 'text-xs' : 'text-[10.5px]'} text-muted">${t.unit}</span>` : ''}
            </div>
            <div class="${t.big ? 'mt-2.5' : 'mt-1.5'} leading-none">${t.delta || `<span class="text-[10px] text-muted">${t.sub || ''}</span>`}</div>
            ${t.delta && t.sub ? `<div class="${t.big ? 'text-[10.5px]' : 'text-[10px]'} text-muted mt-1 leading-tight">${t.sub}</div>` : ''}
          </div>
          <div class="shrink-0 ${chartBox}">${t.chart || ''}</div>
        </div>
      </div>`;
  }
};
