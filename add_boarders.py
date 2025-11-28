#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将国界线烘焙到地球贴图上，避免 Cesium 运行时渲染导致内存泄漏
"""

from PIL import Image, ImageDraw
import json
import os

print('🌍 开始处理国界线...')

# 1. 读取原始地球贴图
earth_path = 'public/texture/earth.jpg'
if not os.path.exists(earth_path):
    print(f'❌ 找不到地球贴图: {earth_path}')
    exit(1)

earth_img = Image.open(earth_path)
width, height = earth_img.size
print(f'✅ 地球贴图尺寸: {width}x{height}')

# 2. 读取国界线 GeoJSON
geojson_path = 'public/maps/countries.geo.json'
if not os.path.exists(geojson_path):
    print(f'❌ 找不到国界线数据: {geojson_path}')
    exit(1)

with open(geojson_path, 'r', encoding='utf-8') as f:
    geojson_data = json.load(f)

print(f'✅ 加载了 {len(geojson_data["features"])} 个国家/地区')

# 3. 创建透明图层用于绘制国界线
borders_layer = Image.new('RGBA', (width, height), (0, 0, 0, 0))
draw = ImageDraw.Draw(borders_layer)

# 4. 坐标转换函数（经纬度 → 像素）
def lonlat_to_pixel(lon, lat):
    """将经纬度转换为图像像素坐标"""
    # 经度 -180~180 映射到 0~width
    x = int((lon + 180) / 360 * width)
    # 纬度 90~-90 映射到 0~height（注意Y轴反向）
    y = int((90 - lat) / 180 * height)
    return (x, y)

# 5. 绘制每个国家的边界
feature_count = 0
for feature in geojson_data['features']:
    geometry = feature['geometry']
    geom_type = geometry['type']
    
    if geom_type == 'Polygon':
        # 单个多边形
        coordinates = geometry['coordinates']
        for ring in coordinates:  # 外环和内环
            if len(ring) < 2:
                continue
            # 转换为像素坐标
            pixel_coords = [lonlat_to_pixel(lon, lat) for lon, lat in ring]
            # 绘制线条
            draw.line(pixel_coords, fill=(255, 255, 255, 153), width=1)  # 白色半透明
            
    elif geom_type == 'MultiPolygon':
        # 多个多边形（如岛国）
        for polygon in geometry['coordinates']:
            for ring in polygon:
                if len(ring) < 2:
                    continue
                pixel_coords = [lonlat_to_pixel(lon, lat) for lon, lat in ring]
                draw.line(pixel_coords, fill=(255, 255, 255, 153), width=1)
    
    feature_count += 1
    if feature_count % 50 == 0:
        print(f'⏳ 已处理 {feature_count}/{len(geojson_data["features"])} 个国家...')

print(f'✅ 所有国界线绘制完成')

# 6. 将国界线叠加到地球贴图上
earth_rgba = earth_img.convert('RGBA')
result = Image.alpha_composite(earth_rgba, borders_layer)

# 7. 保存结果
output_path = 'public/texture/earth_with_borders.jpg'
result.convert('RGB').save(output_path, 'JPEG', quality=95)

print(f'✅ 成功生成带国界线的地球贴图: {output_path}')
print(f'📊 文件大小: {os.path.getsize(output_path) / 1024 / 1024:.2f} MB')
print('🎉 完成！现在刷新页面即可看到国界线，且无内存泄漏。')