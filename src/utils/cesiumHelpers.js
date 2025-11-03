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
  
  // 为每个卫星生成随机的初始相位偏移和闪烁速度
  const randomPhase = Math.random() * Math.PI * 2;
  const randomSpeed = 0.8 + Math.random() * 0.4; // 随机速度在0.8到1.2之间
  
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
      pixelSize: 3,
      // 使用CallbackProperty创建随机闪烁效果
      color: new Cesium.CallbackProperty(function(time) {
        // 计算闪烁周期,加入随机相位和速度
        const timeValue = Cesium.JulianDate.secondsDifference(time, Cesium.JulianDate.now());
        // 确保透明度在0.65到1.0之间,使闪烁效果稍微明显一点
        const alpha = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(timeValue * Math.PI * randomSpeed + randomPhase));
        return Cesium.Color.ORANGE.withAlpha(alpha); // 卫星颜色
      }, false),
      outlineWidth: 0,
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
  
  // 为每个地面站生成随机的初始相位偏移和闪烁速度
  const randomPhase = Math.random() * Math.PI * 2;
  const randomSpeed = 0.6 + Math.random() * 0.6; // 随机速度在0.6到1.2之间
  
  const entity = {
    id: node.id,
    name: node.id,
    show,
    // 性能优化: 地面站是静态的，直接使用Cartesian3，避免每帧调用CallbackProperty
    position: cartesianPosition,
    point: {
      pixelSize: 2,
      // 使用CallbackProperty创建随机闪烁效果
      color: new Cesium.CallbackProperty(function(time) {
        // 计算闪烁周期，加入随机相位和速度
        const timeValue = Cesium.JulianDate.secondsDifference(time, Cesium.JulianDate.now());
        // 确保透明度在0.7到1.0之间，使闪烁效果稍微明显一点
        const alpha = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(timeValue * Math.PI * randomSpeed + randomPhase));
        return Cesium.Color.RED.withAlpha(alpha);   // 地面站颜色
      }, false),
      outlineWidth: 0,
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
  
  // 为每个ROADM生成随机的初始相位偏移和闪烁速度
  const randomPhase = Math.random() * Math.PI * 2;
  const randomSpeed = 0.7 + Math.random() * 0.5; // 随机速度在0.7到1.2之间
  
  const entity = {
    id: node.id,
    name: node.id,
    show,
    // 性能优化: ROADM是静态的,直接使用Cartesian3,避免每帧调用CallbackProperty
    position: cartesianPosition,
    point: {
      pixelSize: 2,
      // 使用CallbackProperty创建随机闪烁效果
      color: new Cesium.CallbackProperty(function(time) {
        // 计算闪烁周期，加入随机相位和速度
        const timeValue = Cesium.JulianDate.secondsDifference(time, Cesium.JulianDate.now());
        // 确保透明度在0.68到1.0之间，使闪烁效果稍微明显一点
        const alpha = 0.68 + 0.32 * (0.5 + 0.5 * Math.sin(timeValue * Math.PI * randomSpeed + randomPhase));
        // return Cesium.Color.GREENYELLOW.withAlpha(alpha); // ROADM颜色
        return Cesium.Color.fromCssColorString('#a1daf5ff').withAlpha(alpha); // ROADM颜色
      }, false),
      outlineWidth: 0,
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