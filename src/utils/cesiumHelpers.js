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
  
  return {
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
}

export function createStationEntity(node, show = true) {
  return {
    id: node.id,
    name: node.id,
    show,
    position: Cesium.Cartesian3.fromDegrees(
      parseFloat(node.position[0]),
      parseFloat(node.position[1]),
      10
    ),
    point: {
      pixelSize: 2,
      color: Cesium.Color.LIME,
      outlineWidth: 1,
      // outlineColor: Cesium.Color.WHITE,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    }
  };
}

export function createRoadmEntity(node, show = true) {
  return {
    id: node.id,
    name: node.id,
    show,
    position: Cesium.Cartesian3.fromDegrees(
      parseFloat(node.position[0]),
      parseFloat(node.position[1]),
      10
    ),
    point: {
      pixelSize: 2,
      color: Cesium.Color.ORANGE,
      outlineWidth: 1,
      // outlineColor: Cesium.Color.WHITE,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    }
  };
}