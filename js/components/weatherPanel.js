// สภาพอากาศปัจจุบัน + พยากรณ์รายชั่วโมง/รายวัน (ข้อมูลจำลองรูปแบบกรมอุตุนิยมวิทยา)
const WeatherPanel = {
  // ไอคอนสภาพอากาศ (stroke ตามสีที่ส่งเข้า)
  icon(condition, size = 16, color = 'currentColor') {
    const paths = {
      thunderstorm: '<path d="M19 16.9A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4.6 14"/><path d="m13 11-4 6h6l-4 6"/>',
      rain: '<path d="M20 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.3"/><path d="M8 19v2M12 18v3M16 19v2"/>',
      cloudy: '<path d="M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 14.9"/>',
      sunny: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2"/>'
    };
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[condition] || paths.cloudy}</svg>`;
  },

  init(data) {
    const w = data.weather;
    document.getElementById('weather-source').textContent =
      `${w.source} · อัปเดต ${Utils.timeHM(w.updatedAt)} น.`;
    this.renderCurrent(w);
    this.renderHourly(w);
    this.renderDaily(w);
  },

  renderCurrent(w) {
    const c = w.current;
    const C = CONFIG.COLORS;
    const items = [
      ['ความชื้น', `${c.humidityPct}%`],
      ['ลม', `${c.windKmh} กม./ชม.`],
      ['ทิศลม', c.windDir],
      ['ความกดอากาศ', `${c.pressureHpa} hPa`]
    ];
    document.getElementById('weather-current').innerHTML = `
      <div class="rounded-lg bg-surface2 border border-line/10 p-3">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-s3/15 border border-s3/30 flex items-center justify-center">
            ${this.icon(c.condition, 26, C.s3)}
          </div>
          <div class="flex-1">
            <div class="flex items-baseline gap-2">
              <span class="text-2xl font-semibold tabular-nums">${c.tempC.toFixed(1)}°C</span>
              <span class="text-[11px] text-muted">รู้สึกเหมือน ${c.feelsLikeC.toFixed(0)}°C</span>
            </div>
            <p class="text-[11px] text-ink2 leading-snug">${Utils.esc(c.description)}</p>
          </div>
        </div>
        <div class="grid grid-cols-4 gap-2 mt-3">
          ${items.map(([k, v]) => `
            <div class="text-center rounded bg-page/60 py-1.5">
              <div class="text-[10px] text-muted">${k}</div>
              <div class="text-[11.5px] font-medium text-ink">${v}</div>
            </div>`).join('')}
        </div>
      </div>`;
  },

  // แถบพยากรณ์รายชั่วโมง (เลื่อนแนวนอนได้)
  renderHourly(w) {
    const C = CONFIG.COLORS;
    document.getElementById('weather-hourly').innerHTML = `
      <h3 class="text-xs font-medium text-ink2 mb-2">พยากรณ์รายชั่วโมง</h3>
      <div class="flex gap-1.5 overflow-x-auto scroll-thin pb-1.5">
        ${w.hourly.map(h => `
          <div class="shrink-0 w-[62px] rounded-lg bg-surface2 border border-line/10 py-2 flex flex-col items-center gap-1">
            <span class="text-[10px] text-muted">${h.time}</span>
            ${this.icon(h.condition, 15, h.condition === 'thunderstorm' ? C.crit : C.s1)}
            <span class="text-[11.5px] font-medium text-ink tabular-nums">${h.tempC.toFixed(0)}°</span>
            <span class="text-[9.5px] tabular-nums" style="color:${C.s1}">${Math.round(h.rainProb * 100)}%</span>
          </div>`).join('')}
      </div>`;
  },

  renderDaily(w) {
    const C = CONFIG.COLORS;
    document.getElementById('weather-daily').innerHTML = `
      <h3 class="text-xs font-medium text-ink2 mb-1">พยากรณ์ 3 วัน</h3>
      ${w.daily.map(d => `
        <div class="flex items-center gap-2.5 rounded-lg bg-surface2 border border-line/10 px-3 py-2">
          <span class="w-14 text-[11px] font-medium text-ink shrink-0">${d.label}</span>
          ${this.icon(d.condition, 15, d.condition === 'thunderstorm' ? C.crit : C.s1)}
          <span class="flex-1 text-[10.5px] text-ink2 truncate">${Utils.esc(d.description)}</span>
          <span class="text-[10.5px] tabular-nums shrink-0" style="color:${C.s1}">${Math.round(d.rainProb * 100)}%</span>
          <span class="text-[11px] text-ink tabular-nums shrink-0">${d.minC}–${d.maxC}°</span>
        </div>`).join('')}`;
  }
};
