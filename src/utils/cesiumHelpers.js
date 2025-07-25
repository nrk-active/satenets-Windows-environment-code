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
    model: {
      uri: "/satellite_model/Satellite.gltf",
      scale: 50,
      minimumPixelSize: 50,
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
    billboard: {
      image: "/satellite_model/地面站.png",
      scale: 0.1,
      verticalOrigin: Cesium.VerticalOrigin.CENTER
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
    billboard: {
      image: "/satellite_model/核心交换机.png",
      scale: 0.05,
      verticalOrigin: Cesium.VerticalOrigin.CENTER
    }
  };
}