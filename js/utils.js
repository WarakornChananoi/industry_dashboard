// ฟังก์ชันช่วยเหลือส่วนกลาง
const Utils = {
  // จัดรูปแบบตัวเลขคั่นหลักพัน เช่น 12,450
  num(n, digits = 0) {
    return Number(n).toLocaleString('th-TH', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  },

  // จัดรูปแบบเงินบาท
  baht(n, digits = 0) {
    return '฿' + Utils.num(n, digits);
  },

  // ย่อจำนวนใหญ่ เช่น 12.9K
  compact(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
    return Utils.num(n);
  },

  // เวลาแบบ "x นาทีที่แล้ว" เทียบกับเวลาที่ข้อมูลถูกอัปเดตล่าสุด
  timeAgo(iso, nowIso) {
    const now = nowIso ? new Date(nowIso) : new Date();
    const diffMin = Math.max(0, Math.round((now - new Date(iso)) / 60000));
    if (diffMin < 1) return 'เมื่อครู่';
    if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
    const h = Math.floor(diffMin / 60);
    if (h < 24) return `${h} ชม.ที่แล้ว`;
    return `${Math.floor(h / 24)} วันที่แล้ว`;
  },

  // เวลาแบบ HH:MM
  timeHM(iso) {
    return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  },

  // สร้างชิ้นส่วน badge สถานะจากตาราง meta (CONFIG.STATUS / RISK / SEVERITY / BILL_STATUS)
  badge(meta) {
    return `<span class="badge ${meta.badge}"><span class="dot" style="background:${meta.color || 'currentColor'}"></span>${meta.label}</span>`;
  },

  // แปลง HTML string เป็น element
  el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  },

  // escape ข้อความก่อนใส่ลง HTML
  esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
};
