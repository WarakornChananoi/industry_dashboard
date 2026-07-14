// ระดับน้ำ + คาดการณ์ระดับน้ำ (AI) + รายการแจ้งเตือนระดับน้ำ — สำหรับหน้าแผนที่ GIS
// ใช้ข้อมูลชุดเดียวกับหน้าภาพรวม (sensors ระดับน้ำจริง + predictions คาดการณ์ AI)
// แจ้งเตือน/แถบระดับน้ำ คลิกได้เพื่อโฟกัสตำแหน่งบนแผนที่ (GisMap.focus)
const WaterLevelPanel = {
  chart: null,
  data: null,
  levelSensors: [],

  init(data) {
    this.data = data;
    // เฉพาะเซนเซอร์ที่วัดระดับน้ำในคลอง/จุดระบาย (มีเกณฑ์วิกฤต) — ไม่รวมถังเก็บน้ำ
    this.levelSensors = data.sensors.sensors.filter(
      s => s.readings.waterLevel != null && s.readings.floodThreshold != null
    );

    document.getElementById('wl-model').textContent =
      `โมเดล ${data.predictions.model} · ล่วงหน้า ${data.predictions.horizonHours} ชม. · ประมวลผล ${Utils.timeHM(data.predictions.generatedAt)} น.`;

    const select = document.getElementById('wl-station');
    const prev = select.value; // คงสถานีที่เลือกไว้เมื่อ render ซ้ำ (สลับธีม)
    select.innerHTML = data.predictions.stations.map((s, i) =>
      `<option value="${i}">${Utils.esc(s.name)} (${s.stationId})</option>`).join('');
    const worst = data.predictions.stations.reduce((m, s, i, arr) => s.riskScore > arr[m].riskScore ? i : m, 0);
    const current = prev !== '' ? +prev : worst;
    select.value = String(current);
    select.onchange = () => this.renderStation(+select.value);

    this.renderStation(current);
    this.renderGauges();
    this.renderAlerts();
  },

  renderStation(idx) {
    const st = this.data.predictions.stations[idx];
    this.renderRisk(st);
    this.renderChart(st);
  },

  // อัตราการเปลี่ยนแปลงระดับน้ำต่อชั่วโมง (history เก็บทุก 2 ชม.)
  risingRate(s) {
    const h = s.history && s.history.waterLevel;
    if (!h || h.length < 2) return 0;
    return (h[h.length - 1] - h[h.length - 2]) / 2;
  },

  // เวลาที่เส้นคาดการณ์ตัดเกณฑ์วิกฤตครั้งแรก
  etaToThreshold(st) {
    for (let i = 0; i < st.forecastLevels.length; i++) {
      if (st.forecastLevels[i] >= st.floodThreshold) return st.forecastLabels[i];
    }
    return null;
  },

  // แถบสรุปความเสี่ยงของสถานีที่เลือก
  renderRisk(st) {
    const meta = CONFIG.RISK[st.riskLevel];
    const score = Math.round(st.riskScore * 100);
    const eta = this.etaToThreshold(st);
    document.getElementById('wl-risk').innerHTML = `
      <div class="rounded-lg bg-surface2 border border-line/10 border-l-2 p-2.5" style="border-left-color:${meta.color}">
        <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div class="flex items-center gap-2">
            ${Utils.badge(meta)}
            <span class="text-xs text-ink2">ปัจจุบัน <b class="text-ink">${st.currentLevel.toFixed(2)} ม.</b> / เกณฑ์ ${st.floodThreshold} ม.</span>
          </div>
          <span class="text-xs text-ink2">คาดสูงสุด <b class="text-ink">${st.peakLevel.toFixed(2)} ม.</b> ที่ ${st.peakAt}${eta ? ` · <span style="color:${st.riskLevel === 'high' ? CONFIG.COLORS.crit : 'var(--warn-text)'}">แตะเกณฑ์ ~${eta} น.</span>` : ''}</span>
        </div>
        <div class="meter mt-2"><span style="width:${score}%;background:${meta.color}"></span></div>
      </div>`;
  },

  renderChart(st) {
    const labels = [...st.pastLabels, ...st.forecastLabels];
    const nPast = st.pastLevels.length;
    const actual = [...st.pastLevels, ...Array(st.forecastLevels.length).fill(null)];
    const forecast = Array(nPast - 1).fill(null).concat([st.pastLevels[nPast - 1]], st.forecastLevels);
    const threshold = labels.map(() => st.floodThreshold);

    const C = CONFIG.COLORS;
    const cfg = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'ระดับน้ำจริง', data: actual,
            borderColor: C.s1, backgroundColor: C.s1 + '1a',
            borderWidth: 2, fill: true, tension: 0.35,
            pointRadius: 0, pointHoverRadius: 5,
            pointHoverBackgroundColor: C.s1, pointHoverBorderColor: C.surface, pointHoverBorderWidth: 2
          },
          {
            label: 'คาดการณ์ AI', data: forecast,
            borderColor: C.s3, borderDash: [6, 4],
            borderWidth: 2, fill: false, tension: 0.35,
            pointRadius: 0, pointHoverRadius: 5,
            pointHoverBackgroundColor: C.s3, pointHoverBorderColor: C.surface, pointHoverBorderWidth: 2
          },
          {
            label: 'เกณฑ์วิกฤต', data: threshold,
            borderColor: C.crit, borderDash: [2, 3],
            borderWidth: 1.5, fill: false, pointRadius: 0, pointHoverRadius: 0
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'line', boxWidth: 18, padding: 14 } },
          tooltip: {
            callbacks: {
              label: ctx => ctx.parsed.y == null ? null : ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} ม.`
            }
          }
        },
        scales: {
          x: { grid: { color: C.grid }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
          y: {
            grid: { color: C.grid },
            title: { display: true, text: 'ระดับน้ำ (ม.)', color: C.muted, font: { size: 10 } },
            suggestedMax: st.floodThreshold + 0.3
          }
        }
      }
    };
    if (this.chart) this.chart.destroy();
    this.chart = new Chart(document.getElementById('wl-chart'), cfg);
  },

  // แถบระดับน้ำปัจจุบันทุกจุด — คลิกเพื่อโฟกัสแผนที่
  renderGauges() {
    const box = document.getElementById('wl-gauges');
    box.innerHTML = this.levelSensors.map(s => {
      const r = s.readings;
      const pct = Math.min(100, r.waterLevel / r.floodThreshold * 100);
      const meta = CONFIG.STATUS[s.status];
      const rate = this.risingRate(s);
      return `
        <div class="cursor-pointer group" data-lat="${s.lat}" data-lng="${s.lng}">
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="text-[11px] font-medium text-ink truncate group-hover:text-s1">${s.id} · ${Utils.esc(s.name)}</span>
            <span class="text-[11px] tabular-nums shrink-0" style="color:${meta.textColor || meta.color}">${r.waterLevel.toFixed(2)}/${r.floodThreshold} ม.</span>
          </div>
          <div class="meter"><span style="width:${pct}%;background:${meta.color}"></span></div>
          <div class="text-[9.5px] text-muted mt-0.5">
            ${Math.round(pct)}% ของเกณฑ์วิกฤต${rate > 0.01 ? ` · <span style="color:var(--warn-text)">น้ำขึ้น +${rate.toFixed(2)} ม./ชม.</span>` : ' · ทรงตัว'}
          </div>
        </div>`;
    }).join('');
    box.querySelectorAll('[data-lat]').forEach(el =>
      el.addEventListener('click', () => GisMap.focus(+el.dataset.lat, +el.dataset.lng)));
  },

  // สร้างรายการแจ้งเตือนจากค่าจริง (เซนเซอร์) + คาดการณ์ AI (predictions)
  buildAlerts() {
    const out = [];
    const P = this.data.predictions;

    // 1) แจ้งเตือนจากค่าระดับน้ำจริง
    this.levelSensors.forEach(s => {
      if (s.status !== 'critical' && s.status !== 'warning') return;
      const r = s.readings;
      const pct = Math.round(r.waterLevel / r.floodThreshold * 100);
      const rate = this.risingRate(s);
      out.push({
        sev: s.status === 'critical' ? 'critical' : 'warning',
        lat: s.lat, lng: s.lng, forecast: false, time: s.lastUpdate,
        title: `${s.id} ระดับน้ำ${s.status === 'critical' ? 'วิกฤต' : 'เฝ้าระวัง'} ${r.waterLevel.toFixed(2)} ม. (${pct}% ของเกณฑ์)`,
        detail: `${Utils.esc(s.name)} · ${rate > 0.01 ? `น้ำขึ้น +${rate.toFixed(2)} ม./ชม.` : 'ระดับทรงตัว'} · เกณฑ์วิกฤต ${r.floodThreshold} ม.`
      });
    });

    // 2) แจ้งเตือนจากการคาดการณ์ AI ล่วงหน้า
    P.stations.forEach(st => {
      const eta = this.etaToThreshold(st);
      if (eta) {
        out.push({
          sev: st.riskLevel === 'high' ? 'critical' : 'serious',
          lat: st.lat, lng: st.lng, forecast: true, time: P.generatedAt,
          title: `${st.stationId} คาดว่าจะแตะเกณฑ์วิกฤตใน ~${eta} น.`,
          detail: `AI คาดการณ์ระดับสูงสุด ${st.peakLevel.toFixed(2)} ม. ที่ ${st.peakAt} · เกณฑ์ ${st.floodThreshold} ม. · ความเสี่ยง ${Math.round(st.riskScore * 100)}%`
        });
      } else if (st.peakLevel / st.floodThreshold >= 0.9) {
        out.push({
          sev: 'warning',
          lat: st.lat, lng: st.lng, forecast: true, time: P.generatedAt,
          title: `${st.stationId} คาดการณ์ระดับน้ำใกล้เกณฑ์วิกฤต (${Math.round(st.peakLevel / st.floodThreshold * 100)}%)`,
          detail: `AI คาดการณ์สูงสุด ${st.peakLevel.toFixed(2)} ม. ที่ ${st.peakAt} · เกณฑ์ ${st.floodThreshold} ม. — เฝ้าระวังใกล้ชิด`
        });
      }
    });

    const order = { critical: 0, serious: 1, warning: 2, info: 3 };
    out.sort((a, b) => order[a.sev] - order[b.sev]);
    return out;
  },

  renderAlerts() {
    const alerts = this.buildAlerts();
    document.getElementById('wl-alert-sub').textContent =
      `${alerts.length} รายการ · ค่าจริงจากเซนเซอร์ + คาดการณ์ AI`;

    const box = document.getElementById('wl-alerts');
    if (!alerts.length) {
      box.innerHTML = '<div class="text-[11px] text-muted">— ไม่มีการแจ้งเตือนระดับน้ำ —</div>';
      return;
    }
    box.innerHTML = alerts.map(a => {
      const meta = CONFIG.SEVERITY[a.sev];
      const tag = a.forecast
        ? '<span class="text-[10px] px-1.5 py-px rounded bg-s3/15 text-s3 font-medium">คาดการณ์ AI</span>'
        : '<span class="text-[10px] px-1.5 py-px rounded bg-s1/15 text-s1 font-medium">ค่าจริง</span>';
      return `
        <div class="rounded-lg bg-surface2 border border-line/10 border-l-2 p-2.5 cursor-pointer hover:border-line/25 transition-colors"
             style="border-left-color:${meta.color}" data-lat="${a.lat}" data-lng="${a.lng}">
          <div class="flex items-center gap-2 mb-1">
            ${Utils.badge(meta)}
            ${tag}
            <span class="text-[10px] text-muted ml-auto">${Utils.timeHM(a.time)} น.</span>
          </div>
          <div class="text-[11.5px] font-medium text-ink leading-snug">${a.title}</div>
          <div class="text-[10.5px] text-ink2 leading-relaxed mt-0.5">${a.detail}</div>
        </div>`;
    }).join('');

    box.querySelectorAll('[data-lat]').forEach(el =>
      el.addEventListener('click', () => GisMap.focus(+el.dataset.lat, +el.dataset.lng)));
  }
};
