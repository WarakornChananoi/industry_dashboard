// โหลดข้อมูลจำลองจากไฟล์ JSON ทั้งหมดใน data/
const DataService = {
  async loadJSON(name) {
    const res = await fetch(`data/${name}.json`);
    if (!res.ok) throw new Error(`โหลด data/${name}.json ไม่สำเร็จ (${res.status})`);
    return res.json();
  },

  // โหลดทุกชุดข้อมูลพร้อมกัน
  async loadAll() {
    const [sensors, predictions, scada, anomalies, buildings] = await Promise.all([
      this.loadJSON('sensors'),
      this.loadJSON('predictions'),
      this.loadJSON('scada'),
      this.loadJSON('anomalies'),
      this.loadJSON('buildings')
    ]);
    return { sensors, predictions, scada, anomalies, buildings };
  },

  // ชุดข้อมูลของหน้าแผนที่ GIS (เพิ่ม ฝน / สภาพอากาศ / โซนคาดการณ์น้ำท่วม)
  async loadAllGis() {
    const [sensors, predictions, scada, anomalies, buildings, rainfall, weather, floodzones] =
      await Promise.all([
        this.loadJSON('sensors'),
        this.loadJSON('predictions'),
        this.loadJSON('scada'),
        this.loadJSON('anomalies'),
        this.loadJSON('buildings'),
        this.loadJSON('rainfall'),
        this.loadJSON('weather'),
        this.loadJSON('floodzones')
      ]);
    return { sensors, predictions, scada, anomalies, buildings, rainfall, weather, floodzones };
  },

  // ชุดข้อมูลของหน้า Smart Traffic (กล้อง AI CCTV/LPR / sensor จราจร / รถที่ติดตาม / เหตุการณ์)
  async loadAllTraffic() {
    const [cctv, trafficsensors, vehicles, trafficops] = await Promise.all([
      this.loadJSON('cctv'),
      this.loadJSON('trafficsensors'),
      this.loadJSON('vehicles'),
      this.loadJSON('trafficops')
    ]);
    return { cctv, trafficsensors, vehicles, trafficops };
  },

  // คำนวณบิลค่าน้ำจากปริมาณการใช้จริงตาม rateConfig
  // (ส่วนคำนวณของ Meter Billing System)
  computeBill(building, rateConfig) {
    const usage = building.usage.lastMonthM3;
    const waterCharge = usage * rateConfig.waterRatePerM3;
    const wastewaterCharge = usage * rateConfig.wastewaterFactor * rateConfig.wastewaterRatePerM3;
    const serviceFee = rateConfig.serviceFeePerMonth;
    const subtotal = waterCharge + wastewaterCharge + serviceFee;
    const vat = subtotal * rateConfig.vatRate;
    return {
      usage,
      waterCharge,
      wastewaterCharge,
      serviceFee,
      subtotal,
      vat,
      total: subtotal + vat
    };
  }
};
