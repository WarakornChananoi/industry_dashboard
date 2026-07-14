// ฟีดผลตรวจจับความผิดปกติจากระบบ AI (ครอบคลุมเซนเซอร์ / ปั๊ม / มิเตอร์ / เครือข่าย)
const AnomalyPanel = {
  init(data) {
    const a = data.anomalies;
    document.getElementById('anomaly-model').textContent =
      `${a.model} · เฝ้าระวัง ${a.scannedSystems.length} ระบบ`;

    this.renderStats(a.events);
    this.renderList(a.events, a.updatedAt);
  },

  renderStats(events) {
    const count = sev => events.filter(e => e.severity === sev && e.status !== 'resolved').length;
    const resolved = events.filter(e => e.status === 'resolved').length;
    const stats = [
      { label: 'วิกฤต', value: count('critical'), color: CONFIG.COLORS.crit },
      { label: 'รุนแรง', value: count('serious'), color: CONFIG.COLORS.serious },
      { label: 'เฝ้าระวัง', value: count('warning'), color: CONFIG.COLORS.warn },
      { label: 'ปิดแล้ว', value: resolved, color: CONFIG.COLORS.muted }
    ];
    document.getElementById('anomaly-stats').innerHTML = stats.map(s => `
      <div class="rounded-lg bg-surface2 border border-line/10 px-2 py-2 text-center">
        <div class="text-lg font-semibold" style="color:${s.color}">${s.value}</div>
        <div class="text-[10px] text-muted">${s.label}</div>
      </div>
    `).join('');
  },

  renderList(events, nowIso) {
    const wrap = document.getElementById('anomaly-list');
    const statusLabel = { active: 'กำลังตรวจสอบ', acknowledged: 'รับทราบแล้ว', resolved: 'แก้ไขแล้ว' };

    wrap.innerHTML = '';
    events.forEach(e => {
      const sev = CONFIG.SEVERITY[e.severity];
      const conf = Math.round(e.confidence * 100);
      const item = Utils.el(`
        <div class="rounded-lg bg-surface2 border border-line/10 p-3 border-l-2 ${e.status === 'resolved' ? 'opacity-60' : ''}"
             style="border-left-color:${sev.color}">
          <div class="flex items-start justify-between gap-2">
            <div class="text-xs font-medium text-ink leading-snug">${Utils.esc(e.title)}</div>
            ${Utils.badge(sev)}
          </div>
          <p class="text-[11px] text-ink2 mt-1.5 leading-relaxed">${Utils.esc(e.description)}</p>
          <div class="flex items-center gap-2 mt-2">
            <div class="meter grow" title="ความเชื่อมั่นของโมเดล">
              <span style="width:${conf}%;background:${sev.color}"></span>
            </div>
            <span class="text-[10px] text-muted whitespace-nowrap">เชื่อมั่น ${conf}%</span>
          </div>
          <div class="flex items-center justify-between mt-2 text-[10px] text-muted">
            <span>${Utils.esc(e.system)} · ${statusLabel[e.status]} · ${Utils.timeAgo(e.timestamp, nowIso)}</span>
            ${e.lat != null ? `<button class="anomaly-map-btn text-s1 hover:underline" data-lat="${e.lat}" data-lng="${e.lng}">ดูบนแผนที่ →</button>` : ''}
          </div>
        </div>
      `);
      wrap.appendChild(item);
    });

    wrap.querySelectorAll('.anomaly-map-btn').forEach(btn => {
      btn.addEventListener('click', () =>
        MapComponent.focus(parseFloat(btn.dataset.lat), parseFloat(btn.dataset.lng)));
    });
  }
};
