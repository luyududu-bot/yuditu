const sticker = (id, category, title, scale = .72) => ({
  id, category, title, scale, src: `./assets/journal-stickers/${id}.png`,
});

export const journalStickers = [
  sticker("building-classic", "建筑", "古典建筑"),
  sticker("building-modern", "建筑", "校园楼宇"),
  sticker("thinker", "人物", "思考者", .62),
  sticker("flower", "花草", "樱花枝", .62),
  sticker("tree", "花草", "校园树木", .62),
  sticker("pink-tape", "胶带", "粉色纸胶带", .58),
  sticker("pink-note", "便签", "粉色便签", .58),
  sticker("photo-frame", "相框", "拍立得相框", .64),
  sticker("text-label", "文字", "今日记录", .62),
  sticker("camera-icon", "图标", "相机", .58),
  sticker("heart-icon", "图标", "爱心", .58),
  sticker("paper-tag", "标签", "纸张标签", .58),
];
