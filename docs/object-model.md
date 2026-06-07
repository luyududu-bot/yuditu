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
