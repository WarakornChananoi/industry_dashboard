// แผงควบคุมภาพ CCTV (Video Wall)
// - จอหลัก (featured): สลับกล้องได้ + กรอบ AI ตรวจจับวัตถุหมุนวน + Live info + ปุ่ม PTZ
// - แดชบอร์ดความปลอดภัย: สรุป 7 วัน / สุขภาพอุปกรณ์ / แนวโน้มกิจกรรม / donut การแจ้งเตือน
// - ผังกล้อง 8 จอ เล่นวนจากไฟล์วิดีโอ (สื่อเสรีจาก Wikimedia Commons — ดู assets/cctv/CREDITS.md)
const CctvWall = {
  _clockStarted: false,
  _detTimer: null,
  featuredIdx: 5, // เริ่มที่ CAM-06 (จุดรถรับส่งพนักงาน — คลิปรถบัส)
  trendChart: null,
  donutChart: null,

  init(data) {
    this.data = data;
    this.renderStatus();
    this.renderFeatured();
    this.renderSummary();
    this.renderHealth();
    this.renderTrend();
    this.renderDonut();
    this.renderSecLevel();
    this.renderGrid();
    this.startClock();
  },

  renderStatus() {
    const n = this.data.cctv.cameras.length;
    document.getElementById('cw-status').innerHTML = `
      <span class="dot bg-good"></span> ออนไลน์ ${n}/${n} กล้อง · 25 fps · บันทึกต่อเนื่อง`;
  },

  // ---------- จอหลัก (Featured Camera) ----------
  renderFeatured() {
    const cams = this.data.cctv.cameras;
    const cam = cams[this.featuredIdx];
    const C = CONFIG.COLORS;
    const iconBtn = (path, title) => `
      <button class="w-8 h-8 rounded-lg bg-black/45 hover:bg-black/65 backdrop-blur flex items-center justify-center transition-colors" title="${title}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">${path}</svg>
      </button>`;

    document.getElementById('cw-featured').innerHTML = `
      <div class="relative rounded-xl overflow-hidden border border-line/10 bg-black/80" style="aspect-ratio:16/9">
        <video id="cw-featured-video" class="absolute inset-0 w-full h-full object-cover" src="${cam.media}"
               autoplay muted loop playsinline title="ภาพจำลองสัญญาณ ${Utils.esc(cam.name)}"></video>

        <!-- กรอบ AI ตรวจจับวัตถุ (มุมวงเล็บ + ป้ายชนิดวัตถุ) -->
        <div id="cw-ai-box" class="absolute pointer-events-none" style="transition:all .9s ease;opacity:0">
          <span class="cw-corner" style="left:-2px;top:-2px;border-width:2.5px 0 0 2.5px"></span>
          <span class="cw-corner" style="right:-2px;top:-2px;border-width:2.5px 2.5px 0 0"></span>
          <span class="cw-corner" style="left:-2px;bottom:-2px;border-width:0 0 2.5px 2.5px"></span>
          <span class="cw-corner" style="right:-2px;bottom:-2px;border-width:0 2.5px 2.5px 0"></span>
          <span id="cw-ai-label"
                class="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 backdrop-blur
                       px-2.5 py-1 text-[10.5px] font-semibold text-white flex items-center gap-1.5"></span>
        </div>

        <!-- แถบหัวจอ: สลับกล้อง ‹ › + ชื่อกล้อง -->
        <div class="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          <button id="cw-prev" class="w-8 h-8 rounded-lg bg-black/45 hover:bg-black/65 backdrop-blur flex items-center justify-center" title="กล้องก่อนหน้า">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="m14 6-6 6 6 6"/></svg>
          </button>
          <span class="rounded-lg bg-black/45 backdrop-blur px-3 py-1.5 text-[11.5px] font-semibold text-white">
            ${cam.id} · ${Utils.esc(cam.name)}
          </span>
          <button id="cw-next" class="w-8 h-8 rounded-lg bg-black/45 hover:bg-black/65 backdrop-blur flex items-center justify-center" title="กล้องถัดไป">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="m10 6 6 6-6 6"/></svg>
          </button>
        </div>

        <!-- ปุ่มควบคุม: ไมค์ / ภาพนิ่ง / บันทึก / ซูมแผนที่ -->
        <div class="absolute top-2.5 right-2.5 flex items-center gap-1.5">
          ${iconBtn('<path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4"/>', 'ไมโครโฟน (จำลอง)')}
          ${iconBtn('<path d="M14.5 4h-5L7.8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.8Z"/><circle cx="12" cy="13" r="3.5"/>', 'บันทึกภาพนิ่ง (จำลอง)')}
          <button class="w-8 h-8 rounded-lg bg-black/45 hover:bg-black/65 backdrop-blur flex items-center justify-center" title="กำลังบันทึกวิดีโอ">
            <span class="dot bg-crit marker-critical" style="width:9px;height:9px"></span>
          </button>
          <button onclick="TrafficMap.focusCam('${cam.id}')" class="w-8 h-8 rounded-lg bg-black/45 hover:bg-black/65 backdrop-blur flex items-center justify-center" title="ซูมตำแหน่งกล้องบนแผนที่">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </button>
        </div>

        <!-- Live Camera Info (ล่างซ้าย) -->
        <div class="absolute bottom-3 left-3 rounded-xl bg-black/45 backdrop-blur px-3 py-2.5 text-[10.5px] text-white/90 space-y-1.5 min-w-[190px]">
          <div class="text-[11px] font-semibold text-white mb-0.5">ข้อมูลกล้องสด</div>
          <div class="flex items-center justify-between gap-4">
            <span class="flex items-center gap-1.5"><span class="dot bg-good"></span>ออนไลน์</span>
            <span class="text-white/60">ซิงก์ล่าสุด 10 วิ.</span>
          </div>
          <div class="flex items-center justify-between gap-4">
            <span>ความละเอียด 1080p</span><span class="text-white/60">25 fps</span>
          </div>
          <div class="flex items-center justify-between gap-4">
            <span>เคลื่อนไหวล่าสุด</span><span class="text-white/60">2 นาทีที่แล้ว</span>
          </div>
        </div>

        <!-- ปุ่ม PTZ (ล่างขวา) -->
        <div class="absolute bottom-3 right-3 w-[84px] h-[84px] rounded-full bg-black/45 backdrop-blur flex items-center justify-center">
          ${['M12 5l-4 5h8Z|กล้องเงยขึ้น|top:3px;left:50%;transform:translateX(-50%)',
             'M12 19l4-5H8Z|กล้องก้มลง|bottom:3px;left:50%;transform:translateX(-50%)',
             'M5 12l5-4v8Z|หันซ้าย|left:3px;top:50%;transform:translateY(-50%)',
             'M19 12l-5 4V8Z|หันขวา|right:3px;top:50%;transform:translateY(-50%)'].map(s => {
            const [path, title, pos] = s.split('|');
            return `<button class="absolute w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/15" title="PTZ: ${title}" style="${pos}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff"><path d="${path}"/></svg></button>`;
          }).join('')}
          <span class="w-7 h-7 rounded-full bg-white/85 shadow"></span>
        </div>

        <!-- REC + นาฬิกา (บนสุดของวิดีโอ ใต้แถบหัวจอ) -->
        <div class="cw-clock absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/45 backdrop-blur px-2.5 py-1 text-[10px] font-medium text-white/90 tabular-nums hidden sm:block">--:--:--</div>
      </div>`;

    document.getElementById('cw-prev').addEventListener('click', () => this.cycleFeatured(-1));
    document.getElementById('cw-next').addEventListener('click', () => this.cycleFeatured(1));

    const v = document.getElementById('cw-featured-video');
    v.addEventListener('loadedmetadata', () => {
      v.currentTime = Math.min(2, Math.max((v.duration || 10) - 2, 0));
    }, { once: true });

    this.startDetections(cam);
  },

  cycleFeatured(step) {
    const n = this.data.cctv.cameras.length;
    this.featuredIdx = (this.featuredIdx + step + n) % n;
    this.renderFeatured();
  },

  // หมุนวนกรอบ AI ตรวจจับวัตถุบนจอหลัก (ตำแหน่ง/ป้ายจาก data aiBoxes)
  startDetections(cam) {
    if (this._detTimer) clearInterval(this._detTimer);
    const box = document.getElementById('cw-ai-box');
    const label = document.getElementById('cw-ai-label');
    const boxes = cam.aiBoxes || [];
    if (!boxes.length) { box.style.opacity = 0; return; }
    let i = 0;
    const C = CONFIG.COLORS;
    const show = () => {
      const b = boxes[i % boxes.length];
      Object.assign(box.style, {
        left: b.x + '%', top: b.y + '%', width: b.w + '%', height: b.h + '%', opacity: 1
      });
      label.innerHTML = `
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${C.s3}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12l4 4L19 6"/></svg>
        AI ตรวจจับ: ${Utils.esc(b.label)} <span style="color:${C.warn}">${Math.round(b.conf * 100)}%</span>`;
      i++;
    };
    show();
    this._detTimer = setInterval(show, 3200);
  },

  // ---------- สรุปความปลอดภัย (2x2) ----------
  renderSummary() {
    const s = this.data.cctv.security.summary;
    const C = CONFIG.COLORS;
    const delta = (pct, goodWhenDown = false) => {
      const up = pct >= 0;
      const good = goodWhenDown ? !up : up;
      return `<span class="inline-flex items-center gap-0.5 text-[10px] font-medium" style="color:${good ? C.good : C.crit}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          ${up ? '<path d="M12 19V5M6 11l6-6 6 6"/>' : '<path d="M12 5v14M6 13l6 6 6-6"/>'}
        </svg>${Math.abs(pct)}%</span> <span class="text-[9.5px] text-muted">จากสัปดาห์ก่อน</span>`;
    };
    const tiles = [
      { value: s.suspiciousEvents, label: 'เหตุการณ์น่าสงสัย', d: delta(s.suspiciousDeltaPct, true), color: C.serious },
      { value: s.resolvedIssues, label: 'จัดการแล้ว', d: delta(s.resolvedDeltaPct), color: C.good },
      { value: s.violations, label: 'ฝ่าฝืนกฎจราจร', d: delta(s.violationsDeltaPct, true), color: C.warn },
      { value: s.systemHealthPct + '%', label: 'สุขภาพระบบ', d: delta(s.systemHealthDeltaPct), color: C.s1 }
    ];
    document.getElementById('cw-summary').innerHTML = tiles.map(t => `
      <div class="rounded-lg bg-page/60 border border-line/10 p-2.5">
        <div class="text-xl font-semibold tabular-nums" style="color:${t.color}">${t.value}</div>
        <div class="text-[10.5px] text-ink2 mt-0.5 mb-1">${t.label}</div>
        <div>${t.d}</div>
      </div>`).join('');
  },

  // ---------- สุขภาพอุปกรณ์ (progress bars) ----------
  renderHealth() {
    const C = CONFIG.COLORS;
    document.getElementById('cw-health').innerHTML =
      this.data.cctv.security.deviceHealth.map(d => {
        const color = d.pct >= 70 ? C.good : d.pct >= 45 ? C.warn : C.crit;
        return `
          <div>
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="text-[11px] text-ink truncate">${Utils.esc(d.name)}</span>
              <span class="text-[11px] font-semibold tabular-nums text-ink2">${d.pct}%</span>
            </div>
            <div class="h-1.5 rounded-full bg-page/70 overflow-hidden">
              <div class="h-full rounded-full" style="width:${d.pct}%;background:${color}"></div>
            </div>
          </div>`;
      }).join('');
  },

  // ---------- แนวโน้มกิจกรรมรายสัปดาห์ (line chart) ----------
  renderTrend() {
    const w = this.data.cctv.security.weekly;
    const C = CONFIG.COLORS;
    document.getElementById('cw-trend-legend').innerHTML = `
      <span class="inline-flex items-center gap-1.5"><span class="dot" style="background:${C.s1}"></span>การเคลื่อนไหวรวม</span>
      <span class="inline-flex items-center gap-1.5"><span class="dot" style="background:${C.serious}"></span>เหตุการณ์น่าสงสัย</span>`;
    if (this.trendChart) this.trendChart.destroy();
    this.trendChart = new Chart(document.getElementById('cw-trend-chart'), {
      type: 'line',
      data: {
        labels: w.labels,
        datasets: [
          {
            label: 'การเคลื่อนไหวรวม', data: w.totalMotion,
            borderColor: C.s1, backgroundColor: C.s1 + '22',
            borderWidth: 2, pointRadius: 2.5, pointBackgroundColor: C.s1,
            fill: true, tension: 0.35
          },
          {
            label: 'เหตุการณ์น่าสงสัย', data: w.suspicious,
            borderColor: C.serious, backgroundColor: C.serious + '22',
            borderWidth: 2, pointRadius: 2.5, pointBackgroundColor: C.serious,
            fill: true, tension: 0.35
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} ครั้ง` } }
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: C.grid }, ticks: { maxTicksLimit: 5 } }
        }
      }
    });
  },

  // ---------- การกระจายการแจ้งเตือน (donut) ----------
  renderDonut() {
    const dist = this.data.cctv.security.alertDist;
    const C = CONFIG.COLORS;
    const colors = [C.s1, C.s2, C.s3, C.s5, C.muted];
    document.getElementById('cw-donut-center').innerHTML = `
      <div class="text-lg font-semibold text-ink tabular-nums leading-tight">${Utils.num(dist.total)}</div>
      <div class="text-[9.5px] text-muted">การแจ้งเตือน</div>`;
    document.getElementById('cw-donut-legend').innerHTML = dist.items.map((it, i) => `
      <div class="flex items-center gap-1.5 text-[10px]">
        <span class="dot shrink-0" style="background:${colors[i]}"></span>
        <span class="text-ink2 truncate flex-1">${Utils.esc(it.label)}</span>
        <span class="text-muted tabular-nums">${Math.round(it.count / dist.total * 100)}%</span>
      </div>`).join('');
    if (this.donutChart) this.donutChart.destroy();
    this.donutChart = new Chart(document.getElementById('cw-donut-chart'), {
      type: 'doughnut',
      data: {
        labels: dist.items.map(i => i.label),
        datasets: [{
          data: dist.items.map(i => i.count),
          backgroundColor: colors,
          borderColor: C.surface2,
          borderWidth: 2,
          borderRadius: 3
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${Utils.num(ctx.parsed)} ครั้ง` } }
        }
      }
    });
  },

  // ---------- ระดับความปลอดภัยเฉลี่ย ----------
  renderSecLevel() {
    const C = CONFIG.COLORS;
    document.getElementById('cw-seclevel').innerHTML =
      this.data.cctv.security.securityLevel.map(d => `
        <div>
          <div class="text-[11px] text-ink mb-1">${Utils.esc(d.label)}</div>
          <div class="h-4 rounded-md bg-page/70 overflow-hidden relative">
            <div class="h-full rounded-md" style="width:${d.pct}%;background:linear-gradient(90deg,${C.s1}66,${C.s1})"></div>
            <span class="absolute inset-y-0 flex items-center text-[9.5px] font-semibold tabular-nums"
                  style="left:calc(${d.pct}% - 30px);color:#fff">${d.pct}%</span>
          </div>
        </div>`).join('');
  },

  // ---------- ผังกล้อง 8 จอ ----------
  renderGrid() {
    const grid = document.getElementById('cw-grid');
    grid.innerHTML = this.data.cctv.cameras.map(cam => {
      const isLpr = cam.type !== 'ai_cctv';
      const plates = (cam.recentPlates || []).slice(0, 3).map(p => `
        <span class="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] tabular-nums
              ${p.watch ? 'border-crit/50 bg-crit/10 text-crit font-semibold' : 'border-line/15 bg-surface2 text-ink2'}">
          ${p.watch ? '⚠ ' : ''}${Utils.esc(p.plate)}
          <span class="${p.watch ? 'text-crit/80' : 'text-muted'}">${Utils.timeHM(p.time)}</span>
        </span>`).join('');
      return `
        <div id="cw-tile-${cam.id}" class="rounded-xl border border-line/10 bg-surface2 overflow-hidden transition-shadow">
          <!-- หัวจอ: ชื่อกล้อง (คลิกซูมแผนที่) + LIVE -->
          <button class="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-page/40 transition-colors"
                  onclick="TrafficMap.focusCam('${cam.id}')" title="ซูมไปยังตำแหน่งกล้องบนแผนที่">
            <span class="dot bg-crit marker-critical shrink-0"></span>
            <span class="min-w-0 flex-1">
              <span class="block text-[11.5px] font-semibold text-ink truncate">${cam.id} · ${Utils.esc(cam.name)}</span>
              <span class="block text-[10px] text-muted">${isLpr ? 'AI CCTV + LPR' : 'AI CCTV'} · LIVE</span>
            </span>
            <svg class="shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--muted)">
              <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </button>

          <!-- จอภาพ: วิดีโอเล่นวน + overlay สไตล์กล้องวงจรปิด -->
          <div class="relative w-full overflow-hidden bg-black/70" style="aspect-ratio:16/10">
            <video class="absolute inset-0 w-full h-full object-cover" src="${cam.media}"
                   autoplay muted loop playsinline preload="metadata"
                   title="ภาพจำลองสัญญาณ ${Utils.esc(cam.name)}"></video>
            <div class="absolute top-1.5 left-2 flex items-center gap-1.5 text-[9.5px] font-semibold text-white/90"
                 style="text-shadow:0 1px 3px rgba(0,0,0,.8)">
              <span class="dot bg-crit marker-critical" style="width:6px;height:6px"></span>REC · ${cam.id}
            </div>
            <div class="cw-clock absolute top-1.5 right-2 text-[9.5px] font-medium text-white/90 tabular-nums"
                 style="text-shadow:0 1px 3px rgba(0,0,0,.8)">--:--:--</div>
            <div class="absolute bottom-0 inset-x-0 px-2 py-1 text-[9.5px] text-white/85 tabular-nums"
                 style="background:linear-gradient(transparent,rgba(0,0,0,.7))">
              ${Utils.num(cam.vehiclesPerHr)} คัน/ชม. · เฉลี่ย ${cam.avgSpeedKmh} กม./ชม. · LPR ${Utils.num(cam.lprReadsPerHr)}/ชม.
            </div>
          </div>

          <!-- ผล AI: ป้ายทะเบียนล่าสุดจาก LPR -->
          <div class="px-2.5 py-2">
            <div class="text-[9.5px] text-muted mb-1">LPR อ่านล่าสุด (แม่นยำ ${(cam.lprAccuracy * 100).toFixed(1)}%)</div>
            <div class="flex flex-wrap gap-1">${plates || '<span class="text-[10px] text-muted">—</span>'}</div>
          </div>
        </div>`;
    }).join('');

    // ข้ามช่วงต้นคลิป (บางคลิปเปิดด้วยเฟรมมืด) และให้แต่ละจอเริ่มคนละจุดแบบกล้องจริง
    grid.querySelectorAll('video').forEach((v, i) => {
      v.addEventListener('loadedmetadata', () => {
        const dur = v.duration || 30;
        v.currentTime = Math.min(3 + i * 1.7, Math.max(dur - 2, 0));
      }, { once: true });
    });
  },

  // นาฬิกามุมจอแบบกล้องวงจรปิด (interval เดียว อัปเดตทุกจอ)
  startClock() {
    if (this._clockStarted) return;
    this._clockStarted = true;
    const tick = () => {
      const t = new Date().toLocaleTimeString('th-TH', { hour12: false });
      document.querySelectorAll('.cw-clock').forEach(el => el.textContent = t);
    };
    tick();
    setInterval(tick, 1000);
  },

  // เลื่อนไปที่จอของกล้อง + ไฮไลต์ชั่วครู่ (เรียกจาก popup บนแผนที่)
  show(camId) {
    const tile = document.getElementById(`cw-tile-${camId}`);
    if (!tile) return;
    tile.scrollIntoView({ behavior: 'smooth', block: 'center' });
    tile.style.boxShadow = `0 0 0 2px ${CONFIG.COLORS.s1}`;
    setTimeout(() => { tile.style.boxShadow = ''; }, 2500);
  }
};
