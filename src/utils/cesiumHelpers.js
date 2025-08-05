// src/utils/cesiumHelpers.js
import * as Cesium from "cesium";

export function getEntityPosition(node) {
  if (node.type === 'satellite') {
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
  return {
    id: node.id,
    name: node.id,
    show,
    position: new Cesium.Cartesian3(
      parseFloat(node.position[0]) * 1000, 
      parseFloat(node.position[1]) * 1000, 
      parseFloat(node.position[2]) * 1000
    ),
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