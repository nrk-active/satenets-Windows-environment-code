// src/utils/orbitReader.js
// 轨道数据读取工具
// 根据文件夹名称和卫星ID读取等间隔的5个位置点用于绘制轨道

import * as Cesium from 'cesium';
import { parseFolderName } from './folderParser.js';

/**
 * 读取指定卫星在5个等间隔时间点的位置数据
 * @param {string} folderName - 数据文件夹名称，格式如 "new_10s_3600s"
 * @param {string} satelliteId - 卫星ID，格式如 "satellite:0:0"
 * @returns {Promise<Array>} - 返回包含5个位置点的数组，每个点包含 {x, y, z, timestamp}
 */
export async function readSatelliteOrbitPoints(folderName, satelliteId) {
  if (!folderName || !satelliteId) {
    console.error('❌ orbitReader: 缺少必要参数', { folderName, satelliteId });
    return [];
  }
  
  console.log('📡 orbitReader: 开始读取轨道数据', { folderName, satelliteId });
  
  // 解析文件夹名称获取配置
  const config = parseFolderName(folderName);
  
  if (config.isDefault) {
    console.warn('⚠️ orbitReader: 未选择有效的数据文件夹');
    return [];
  }
  
  const { interval, totalDuration, totalFrames } = config;
  
  console.log('📊 orbitReader: 文件夹配置', {
    folderName,
    interval,
    totalDuration,
    totalFrames
  });
  
  // 计算5个等间隔的帧索引
  // 例如：如果总共360帧，则选择第1, 91, 181, 271, 360帧
  const numPoints = 5;
  const frameStep = Math.floor((totalFrames - 1) / (numPoints - 1));
  const frameIndices = [];
  
  for (let i = 0; i < numPoints; i++) {
    if (i === numPoints - 1) {
      // 最后一个点使用最后一帧
      frameIndices.push(totalFrames);
    } else {
      frameIndices.push(1 + i * frameStep);
    }
  }
  
  console.log(`orbitReader: 读取卫星 ${satelliteId} 的轨道点`, {
    folderName,
    totalFrames,
    frameIndices,
    interval
  });
  
  // 读取各个帧的数据文件
  const positions = [];
  
  for (const frameIndex of frameIndices) {
    try {
      // 计算时间戳
      const timestamp = frameIndex * interval;
      
      // 构造文件路径
      const fileName = `network_state_${timestamp.toFixed(2)}.json`;
      const filePath = `/data/${folderName}/${fileName}`;
      
      // 读取文件
      const response = await fetch(filePath);
      if (!response.ok) {
        console.warn(`orbitReader: 无法读取文件 ${filePath}`);
        continue;
      }
      
      const data = await response.json();
      
      // 查找指定卫星的位置数据
      const satelliteData = data?.data?.graph_nodes?.[satelliteId];
      
      if (!satelliteData || !satelliteData.current_position) {
        console.warn(`orbitReader: 在文件 ${fileName} 中找不到卫星 ${satelliteId} 的位置数据`);
        continue;
      }
      
      const pos = satelliteData.current_position;
      positions.push({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        timestamp: pos.timestamp,
        frameIndex: frameIndex
      });
      
      console.log(`orbitReader: 读取帧 ${frameIndex} (时间戳 ${timestamp}s)`, pos);
      
    } catch (error) {
      console.error(`orbitReader: 读取帧 ${frameIndex} 时出错`, error);
    }
  }
  
  if (positions.length < 2) {
    console.warn(`orbitReader: 轨道点数量不足 (${positions.length} < 2)，无法绘制轨道`);
    return [];
  }
  
  console.log(`orbitReader: 成功读取 ${positions.length} 个轨道点`, positions);
  return positions;
}

/**
 * 将卫星位置从笛卡尔坐标(km)转换为Cesium Cartesian3坐标(米)
 * @param {Object} position - 位置对象 {x, y, z}，单位为km
 * @returns {Cesium.Cartesian3} - Cesium坐标
 */
export function convertToCartesian3(position) {
  // 数据中的坐标单位是km，需要转换为米
  return new Cesium.Cartesian3(
    position.x * 1000,
    position.y * 1000,
    position.z * 1000
  );
}
