// src/utils/dataProcessors.js
export function extractCoordinates(data) {
  if (!data) return null;

  // x,y,z 格式
  if (data.x !== undefined && data.y !== undefined && data.z !== undefined) {
    return [data.x, data.y, data.z];
  }
  
  // position 数组
  if (Array.isArray(data.position) && data.position.length >= 2) {
    return data.position;
  }
  
  // current_position 对象
  if (data.current_position) {
    return [data.current_position.x, data.current_position.y, data.current_position.z];
  }
  
  // location 数组 (lat, lon 顺序)
  if (data.location && Array.isArray(data.location) && data.location.length >= 2) {
    return [data.location[1], data.location[0]]; // 转换为 [lon, lat]
  }
  
  // longitude, latitude 对象
  if (data.longitude !== undefined && data.latitude !== undefined) {
    return [data.longitude, data.latitude];
  }
  
  // lon, lat 对象
  if (data.lon !== undefined && data.lat !== undefined) {
    return [data.lat, data.lon];
  }
  
  return null;
}

export function processGraphData(rawData) {
  const nodes = [];
  const edges = [];
  const nodeMap = {};
  
  if (rawData.data.graph_nodes) {
    Object.entries(rawData.data.graph_nodes).forEach(([nodeId, nodeData]) => {
      let position;
      let type;
      
      // 卫星节点
      if (nodeId.startsWith('satellite')) {
        position = extractCoordinates(rawData.data.satellite_positions_summary?.[nodeId]) || 
                   extractCoordinates(nodeData);
        type = 'satellite';
      } 
      // 地面站节点
      else if (nodeData.type === 'station') {
        position = extractCoordinates(nodeData);
        type = 'station';
      }
      // ROADM节点
      else if (nodeId.startsWith('ROADM')) {
        position = extractCoordinates(nodeData);
        type = 'roadm';
      }
      
      if (position) {
        const node = { id: nodeId, type, position };
        nodes.push(node);
        nodeMap[nodeId] = node;
      }
    });
  }
  
  // 处理边数据
  if (rawData.data.graph_edges) {
    Object.keys(rawData.data.graph_edges).forEach(edgeId => {
      try {
        const [source, target] = edgeId.split(',');
        if (nodeMap[source] && nodeMap[target]) {
          edges.push({ source, target });
        }
      } catch (e) {
        console.error(`处理边 ${edgeId} 时出错`);
      }
    });
  }

  return { nodes, edges };
}