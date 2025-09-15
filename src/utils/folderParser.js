// src/utils/folderParser.js
// 解析文件夹名称格式：{类型}_{切片间隔}_{总时长}
export function parseFolderName(folderName) {
  if (!folderName) {
    // 没有文件夹时返回一个默认配置，但标记为未选择状态
    return {
      type: 'none',
      interval: 60,  // 默认60秒，仅用于时间轴显示
      totalDuration: 360, // 默认6分钟，仅用于时间轴显示
      totalFrames: 6,
      playbackInterval: 2000, // 固定2秒播放间隔
      isDefault: true // 标记这是默认配置
    };
  }
  
  // 尝试解析新格式：如 "old_60s_360s"
  const newFormatMatch = folderName.match(/^(\w+)_(\d+)s_(\d+)s$/);
  if (newFormatMatch) {
    const [, type, intervalStr, durationStr] = newFormatMatch;
    const interval = parseInt(intervalStr, 10);
    const totalDuration = parseInt(durationStr, 10);
    return {
      type: type,
      interval: interval,
      totalDuration: totalDuration,
      totalFrames: Math.ceil(totalDuration / interval),
      playbackInterval: 2000, // 固定2秒播放间隔（动画帧之间的等待时间）
      isDefault: false
    };
  }
  
  // 兼容老格式
  if (folderName === 'new') {
    return { 
      type: 'new', 
      interval: 10, 
      totalDuration: 3600, 
      totalFrames: 360,
      playbackInterval: 2000, // 固定2秒播放间隔
      isDefault: false 
    };
  } else if (folderName === 'old') {
    return { 
      type: 'old', 
      interval: 60, 
      totalDuration: 360, 
      totalFrames: 6,
      playbackInterval: 2000, // 固定2秒播放间隔
      isDefault: false 
    };
  }
  
  // 如果无法解析，返回默认配置
  return {
    type: 'unknown',
    interval: 60,
    totalDuration: 360,
    totalFrames: 6,
    playbackInterval: 2000, // 固定2秒播放间隔
    isDefault: true
  };
}