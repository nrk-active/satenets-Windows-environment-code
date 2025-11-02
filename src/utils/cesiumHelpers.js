// src/utils/cesiumHelpers.js
import * as Cesium from "cesium";

export function getEntityPosition(node, viewer = null, time = null) {
  if (node.type === 'satellite') {
    // 如果提供了 viewer，尝试从实体获取实时位置
    if (viewer) {
      const entity = viewer.entities.getById(node.id);
      if (entity && entity.position) {
        // 如果是 CallbackProperty，获取其当前值
        if (typeof entity.position.getValue === 'function') {
          const currentTime = time || Cesium.JulianDate.now();
          const currentPosition = entity.position.getValue(currentTime);
          if (currentPosition) {
            return currentPosition;
          }
        }
        // 如果是静态位置，直接返回
        else if (entity.position instanceof Cesium.Cartesian3) {
          return entity.position;
        }
      }
    }
    
    // 回退到节点数据中的静态位置
    return new Cesium.Cartesian3(
      parseFloat(node.position[0]) * 1000,
      parseFloat(node.position[1]) * 1000,
      parseFloat(node.position[2]) * 1000
    );
  } else {
    return Cesium.Cartesian3.fromDegrees(
      parseFloat(node.position[0]),
      parseFloat(node.position[1]),
      10
    );
  }
}

export function createSatelliteEntity(node, show = true) {
  const initialPosition = new Cesium.Cartesian3(
    parseFloat(node.position[0]) * 1000, 
    parseFloat(node.position[1]) * 1000, 
    parseFloat(node.position[2]) * 1000
  );
  
  const entity = {
    id: node.id,
    name: node.id,
    show,
    // 使用 CallbackProperty 创建动态位置，即使初始时是静态的
    // 这样在动画时可以无缝切换到动态位置
    position: new Cesium.CallbackProperty(function(time, result) {
      return initialPosition;
    }, false),
    point: {
      pixelSize: 2,
      color: Cesium.Color.RED,
      outlineWidth: 1,
      // outlineColor: Cesium.Color.WHITE,
      heightReference: Cesium.HeightReference.NONE
      // 移除 disableDepthTestDistance 以启用深度测试
    }
  };
  
  // 保存原始笛卡尔坐标，用于2D模式转换
  entity.originalCartesian = {
    x: parseFloat(node.position[0]) * 1000,
    y: parseFloat(node.position[1]) * 1000,
    z: parseFloat(node.position[2]) * 1000
  };
  
  return entity;
}

export function createStationEntity(node, show = true) {
  const longitude = parseFloat(node.position[0]);
  const latitude = parseFloat(node.position[1]);
  
  // console.log(`创建地面站 ${node.id}: 经度=${longitude}, 纬度=${latitude}`);
  
  // 转换为笛卡尔坐标
  const cartesianPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude, 100);
  
  const entity = {
    id: node.id,
    name: node.id,
    show,
    // ✅ 性能优化: 地面站是静态的，直接使用Cartesian3，避免每帧调用CallbackProperty
    position: cartesianPosition,
    point: {
      pixelSize: 2,
      color: Cesium.Color.LIME,
      outlineWidth: 1,
      // 改为NONE，避免2D模式下的贴地问题
      heightReference: Cesium.HeightReference.NONE
      // 移除 disableDepthTestDistance，恢复正常的深度测试遮挡
    }
  };
  
  // 保存原始经纬度信息，用于2D模式转换
  entity.originalLatLon = {
    longitude: longitude,
    latitude: latitude,
    height: 100
  };
  
  // console.log(`地面站 ${node.id} 原始坐标已保存:`, entity.originalLatLon);
  
  return entity;
}

export function createRoadmEntity(node, show = true) {
  const longitude = parseFloat(node.position[0]);
  const latitude = parseFloat(node.position[1]);
  
  // console.log(`创建ROADM ${node.id}: 经度=${longitude}, 纬度=${latitude}`);
  
  // 转换为笛卡尔坐标（类似卫星处理方式）
  const cartesianPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude, 100);
  
  const entity = {
    id: node.id,
    name: node.id,
    show,
    // ✅ 性能优化: ROADM是静态的,直接使用Cartesian3,避免每帧调用CallbackProperty
    position: cartesianPosition,
    point: {
      pixelSize: 2,
      color: Cesium.Color.ORANGE,
      outlineWidth: 1,
      // 改为NONE，避免2D模式下的贴地问题
      heightReference: Cesium.HeightReference.NONE
      // 移除 disableDepthTestDistance，恢复正常的深度测试遮挡
    }
  };
  
  // 保存原始经纬度信息，用于2D模式转换
  entity.originalLatLon = {
    longitude: longitude,
    latitude: latitude,
    height: 100
  };
  
  // console.log(`ROADM ${node.id} 原始坐标已保存:`, entity.originalLatLon);
  
  return entity;
}