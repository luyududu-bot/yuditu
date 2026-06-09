# 屿地图对象模型

## 核心对象

| 对象 | 用途 |
| --- | --- |
| `region` | 表示可显影的校园区域 |
| `place` | 表示建筑、地标与展览空间 |
| `facility` | 表示餐饮、充电、卫生间等服务 |
| `route` | 表示固定路线或目标生成路线 |
| `goal` | 表示用户时间、兴趣与需求 |
| `user_state` | 表示显影、收藏与访问状态 |

## 地点对象示例

```json
{
  "id": "museum",
  "name": "美术馆",
  "type": "place",
  "category": "展览",
  "regionId": "east",
  "tags": ["看展", "代表性", "第一次来", "打卡"],
  "relations": {
    "nearby": ["thinker", "history_museum"],
    "contains": ["cafe", "charging"]
  },
  "actions": ["view_detail", "add_to_route", "create_journal"],
  "constraints": {
    "requiresRegionUnlocked": true
  },
  "metadata": {
    "representativeScore": 0.98,
    "visitMinutes": 8
  }
}
```

## 可执行能力

`src/object-actions.mjs` 为对象提供统一的查询、权限和 action 分发接口：

```text
listObjects(objects, filters, context)
getObject(objects, objectId)
getAvailableActions(object, context)
executeAction(actionId, object, context)
validateObjectData(regions, objects)
```

当地点要求区域已显影时，未显影状态不会暴露详情、聚焦、路线或手账 action。界面适配器负责执行地图聚焦、加入路线、加入手账与设置路线起点。

## 路线与视觉锚点

- 路线规划只读取已显影地点，并综合目标匹配、代表性、访问时间与地点距离。
- 路线结果包含逐站推荐理由，地图以 SVG 曲线连接校准后的地点中心。
- 图形设施使用 `markerAnchors` 配置视觉中心；编号、路线端点和点击位置共享同一校准坐标。
- `validateObjectData` 检查重复 ID、无效区域、悬空关系、未知 action 与无效路线元数据。
