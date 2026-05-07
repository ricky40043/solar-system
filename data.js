// 行星與衛星資料（教學比例 + 真實比例）
// 距離單位：教學模式為相對單位；真實模式以 AU 換算
// 半徑單位：教學模式為視覺尺寸；真實模式以地球半徑為 1
// 公轉週期：地球日
// 自轉週期：地球日

window.SOLAR_DATA = {
  sun: {
    name: "太陽",
    nameEn: "Sun",
    radiusEdu: 8,
    radiusReal: 109,
    color: 0xffcc33,
    emissive: 0xff8800,
    rotationPeriod: 27,
    info: {
      type: "G 型主序星",
      mass: "1.989 × 10³⁰ 公斤",
      diameter: "1,392,700 公里",
      surfaceTemp: "5,500°C",
      coreTemp: "1,500 萬°C",
      age: "約 46 億年",
      desc: "太陽是太陽系中心的恆星，佔太陽系總質量的 99.86%。它透過核融合反應將氫融合成氦，釋放巨大能量。"
    }
  },
  planets: [
    {
      key: "mercury",
      name: "水星",
      nameEn: "Mercury",
      radiusEdu: 0.5,
      radiusReal: 0.383,
      distanceEdu: 14,
      distanceReal: 39,
      orbitalPeriod: 87.97,
      rotationPeriod: 58.6,
      tilt: 0.034,
      color: 0x9c8b7e,
      texture: "rocky_gray",
      moons: [],
      info: {
        type: "類地行星",
        diameter: "4,879 公里",
        mass: "3.301 × 10²³ 公斤（地球 0.055 倍）",
        distance: "0.39 AU（5,790 萬公里）",
        period: "87.97 天",
        day: "58.6 天",
        temp: "-173°C ~ 427°C",
        moons: "0 顆",
        desc: "水星是太陽系最內側、最小的行星，沒有大氣層，表面布滿撞擊坑，溫差極大。"
      }
    },
    {
      key: "venus",
      name: "金星",
      nameEn: "Venus",
      radiusEdu: 0.9,
      radiusReal: 0.949,
      distanceEdu: 20,
      distanceReal: 72,
      orbitalPeriod: 224.7,
      rotationPeriod: -243,
      tilt: 177.4,
      color: 0xe8c07a,
      texture: "venus",
      moons: [],
      info: {
        type: "類地行星",
        diameter: "12,104 公里",
        mass: "4.867 × 10²⁴ 公斤（地球 0.815 倍）",
        distance: "0.72 AU（1.08 億公里）",
        period: "224.7 天",
        day: "243 天（逆向自轉）",
        temp: "464°C（最熱的行星）",
        moons: "0 顆",
        desc: "金星擁有濃厚的二氧化碳大氣層，產生強烈溫室效應。它是夜空中最亮的行星，也稱為晨星或昏星。"
      }
    },
    {
      key: "earth",
      name: "地球",
      nameEn: "Earth",
      radiusEdu: 1.0,
      radiusReal: 1.0,
      distanceEdu: 28,
      distanceReal: 100,
      orbitalPeriod: 365.25,
      rotationPeriod: 1,
      tilt: 23.44,
      color: 0x4a7fc1,
      texture: "earth",
      moons: [
        { name: "月球", nameEn: "Moon", radius: 0.27, distance: 2.0, distanceReal: 2.5, period: 27.3, color: 0xbfbfbf }
      ],
      info: {
        type: "類地行星",
        diameter: "12,742 公里",
        mass: "5.972 × 10²⁴ 公斤",
        distance: "1.00 AU（1.496 億公里）",
        period: "365.25 天",
        day: "23.93 小時",
        temp: "-89°C ~ 58°C（平均 15°C）",
        moons: "1 顆（月球）",
        desc: "地球是已知唯一存在生命的行星，表面 71% 被水覆蓋，擁有保護性的大氣層與磁場。"
      }
    },
    {
      key: "mars",
      name: "火星",
      nameEn: "Mars",
      radiusEdu: 0.6,
      radiusReal: 0.532,
      distanceEdu: 38,
      distanceReal: 152,
      orbitalPeriod: 686.97,
      rotationPeriod: 1.026,
      tilt: 25.19,
      color: 0xc1502e,
      texture: "mars",
      moons: [
        { name: "火衛一", nameEn: "Phobos", radius: 0.08, distance: 1.2, distanceReal: 1.5, period: 0.32, color: 0x8a7060 },
        { name: "火衛二", nameEn: "Deimos", radius: 0.06, distance: 1.8, distanceReal: 2.2, period: 1.26, color: 0x9a8870 }
      ],
      info: {
        type: "類地行星",
        diameter: "6,779 公里",
        mass: "6.39 × 10²³ 公斤（地球 0.107 倍）",
        distance: "1.52 AU（2.28 億公里）",
        period: "686.97 天（約 1.88 年）",
        day: "24.6 小時",
        temp: "-87°C ~ -5°C",
        moons: "2 顆（火衛一、火衛二）",
        desc: "火星因表面氧化鐵而呈紅色，擁有太陽系最高的火山（奧林帕斯山）和最深的峽谷（水手號峽谷）。"
      }
    },
    {
      key: "jupiter",
      name: "木星",
      nameEn: "Jupiter",
      radiusEdu: 3.5,
      radiusReal: 11.21,
      distanceEdu: 60,
      distanceReal: 520,
      orbitalPeriod: 4332.59,
      rotationPeriod: 0.41,
      tilt: 3.13,
      color: 0xd4a373,
      texture: "jupiter",
      moons: [
        { name: "木衛一·埃歐", nameEn: "Io", radius: 0.18, distance: 5.5, distanceReal: 13, period: 1.77, color: 0xe8d878 },
        { name: "木衛二·歐羅巴", nameEn: "Europa", radius: 0.16, distance: 6.5, distanceReal: 15, period: 3.55, color: 0xb8a888 },
        { name: "木衛三·甘尼米德", nameEn: "Ganymede", radius: 0.24, distance: 7.8, distanceReal: 18, period: 7.15, color: 0x9a8a78 },
        { name: "木衛四·卡利斯托", nameEn: "Callisto", radius: 0.22, distance: 9.2, distanceReal: 22, period: 16.69, color: 0x6a5a4a }
      ],
      info: {
        type: "氣態巨行星",
        diameter: "139,820 公里",
        mass: "1.898 × 10²⁷ 公斤（地球 318 倍）",
        distance: "5.20 AU（7.78 億公里）",
        period: "11.86 年",
        day: "9.93 小時（自轉最快）",
        temp: "-145°C（雲頂）",
        moons: "95 顆已確認（伽利略四衛星最著名）",
        desc: "木星是太陽系最大的行星，質量超過其他七大行星總和的 2.5 倍。著名的大紅斑是已存在數百年的巨型風暴。"
      }
    },
    {
      key: "saturn",
      name: "土星",
      nameEn: "Saturn",
      radiusEdu: 3.0,
      radiusReal: 9.45,
      distanceEdu: 85,
      distanceReal: 954,
      orbitalPeriod: 10759.22,
      rotationPeriod: 0.45,
      tilt: 26.73,
      color: 0xe6c98a,
      texture: "saturn",
      hasRings: true,
      ringInner: 1.3,
      ringOuter: 2.3,
      moons: [
        { name: "土衛六·泰坦", nameEn: "Titan", radius: 0.22, distance: 5.5, distanceReal: 14, period: 15.95, color: 0xd49858 },
        { name: "土衛二·恩克拉多斯", nameEn: "Enceladus", radius: 0.10, distance: 4.0, distanceReal: 10, period: 1.37, color: 0xeeeeee },
        { name: "土衛五·瑞亞", nameEn: "Rhea", radius: 0.13, distance: 4.8, distanceReal: 12, period: 4.52, color: 0xc8c0b8 },
        { name: "土衛八·伊阿珀托斯", nameEn: "Iapetus", radius: 0.12, distance: 7.0, distanceReal: 18, period: 79.32, color: 0x8a7060 }
      ],
      info: {
        type: "氣態巨行星",
        diameter: "116,460 公里",
        mass: "5.683 × 10²⁶ 公斤（地球 95 倍）",
        distance: "9.54 AU（14.3 億公里）",
        period: "29.46 年",
        day: "10.7 小時",
        temp: "-178°C（雲頂）",
        moons: "146 顆已確認（泰坦最大）",
        desc: "土星以壯觀的冰塊環系統聞名。它是太陽系密度最低的行星，理論上可漂浮於水上。"
      }
    },
    {
      key: "uranus",
      name: "天王星",
      nameEn: "Uranus",
      radiusEdu: 2.0,
      radiusReal: 4.01,
      distanceEdu: 110,
      distanceReal: 1920,
      orbitalPeriod: 30688.5,
      rotationPeriod: -0.72,
      tilt: 97.77,
      color: 0x9ad3de,
      texture: "uranus",
      hasRings: true,
      ringInner: 1.5,
      ringOuter: 2.0,
      ringOpacity: 0.25,
      moons: [
        { name: "天衛三·泰坦尼亞", nameEn: "Titania", radius: 0.10, distance: 3.5, distanceReal: 9, period: 8.71, color: 0xa89888 },
        { name: "天衛四·歐貝隆", nameEn: "Oberon", radius: 0.10, distance: 4.5, distanceReal: 11, period: 13.46, color: 0x988878 },
        { name: "天衛一·艾瑞爾", nameEn: "Ariel", radius: 0.09, distance: 2.5, distanceReal: 6.5, period: 2.52, color: 0xc0b0a0 }
      ],
      info: {
        type: "冰巨行星",
        diameter: "50,724 公里",
        mass: "8.681 × 10²⁵ 公斤（地球 14.5 倍）",
        distance: "19.20 AU（28.7 億公里）",
        period: "84.01 年",
        day: "17.24 小時（橫躺自轉）",
        temp: "-224°C（最冷的行星大氣）",
        moons: "27 顆已確認",
        desc: "天王星是唯一一顆「橫躺」自轉的行星，自轉軸傾斜近 98°。它含有甲烷因此呈現藍綠色。"
      }
    },
    {
      key: "neptune",
      name: "海王星",
      nameEn: "Neptune",
      radiusEdu: 1.95,
      radiusReal: 3.88,
      distanceEdu: 135,
      distanceReal: 3010,
      orbitalPeriod: 60182,
      rotationPeriod: 0.67,
      tilt: 28.32,
      color: 0x3a6fd9,
      texture: "neptune",
      moons: [
        { name: "海衛一·崔頓", nameEn: "Triton", radius: 0.13, distance: 3.5, distanceReal: 8, period: -5.88, color: 0xc8b8a8 }
      ],
      info: {
        type: "冰巨行星",
        diameter: "49,244 公里",
        mass: "1.024 × 10²⁶ 公斤（地球 17 倍）",
        distance: "30.05 AU（44.9 億公里）",
        period: "164.79 年",
        day: "16.11 小時",
        temp: "-218°C",
        moons: "16 顆已確認（崔頓最大）",
        desc: "海王星是最遙遠的行星，擁有太陽系最強的風（時速 2,100 公里）。崔頓以逆向軌道環繞它。"
      }
    }
  ]
};
