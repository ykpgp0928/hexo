---
title: Orbit-v0.3更新报告
date: 2026-08-15 12:13:32
tags:
  - 开发
  - 编程
  - 更新
categories:
  - [开发, 更新]
cover: https://cdn.ykpgp0928.dpdns.org/v0.3.webp
---
# Orbit v0.3 更新报告

> **版本定位：** 在 v0.2 的多 Widget Runtime 之上，补齐实例生命周期、显式销毁、可访问性恢复入口和最低自动化门禁，为将来的稳定 API 打基础。

## 发布范围

v0.3.0 已以标签 `v0.3.0` 和 GitHub Release 发布，指向提交 `e61e983`；npm 包 `floating-widget-framework` 的 `latest` 也为 `0.3.0`。

相对 `v0.2-baseline`，此次变更涉及 46 个文件，约新增 4,500 行、删除 416 行。改动覆盖 Runtime、Clock/Music Host、Launcher、构建校验、CI、性能说明、阶段设计记录与发行产物。

## 主要更新

### 1. 生命周期成为正式契约

v0.3 引入 `LifecycleScope`，将事件、计时器、DOM、观察器等副作用登记为逆序、幂等、异常隔离的 cleanup 队列。Runtime 同时明确了两个不同操作：

| 操作 | 语义 | 适用场景 |
| --- | --- | --- |
| `setVisible(id, false)` | 隐藏，不释放已创建实例和资源 | 用户在 Launcher 中暂时关闭组件 |
| `destroy(id)` | 显式清理资源并移除实例 | 页面卸载、重建、PJAX 或业务主动销毁 |

`Orbit.mount()` 也改为幂等：新的 `widgets` 配置只更新列出的组件，不会因某个 id 被省略而销毁已经挂载的实例。这避免了增量配置场景下的意外拆除。[4]

### 2. Host adapter 与 Clock 试点

Runtime 通过 Host adapter 获得 `start`、`getRoot`、`destroy` 和 `getVisibilityTargets`，核心层不再写死 Music/Clock 的业务 DOM。Clock 作为试点已覆盖事件解绑、计时器销毁、rAF 拖拽队列取消、DOM 删除和 destroy 后重新 mount；这是本次更新最可信的工程验证。[5]

Clock 的拖拽更新经 `requestAnimationFrame` 合并，展开方向交由共享 `ExpandPolicy` 判断，也将高频视觉更新与可测试几何决策分开。

### 3. Music 接入新边界

Music Host 增加了模板集中创建、状态 class 的单一投影、`data-orbit-portal` 所有权、AudioEngine/MutationObserver/PJAX 监听清理以及显式 `destroyMusicPlayer()`。特别是 dock-list portal 只删除被本实例声明拥有的节点，降低了对页面其他内容的误伤风险。[6]

### 4. Launcher 的可访问性和移动端恢复

Launcher 现在会在打开时聚焦标题或第一个控件、在关闭时恢复触发点焦点，并处理 Tab 循环与 Escape 关闭。若粗指针设备上全部 Widget 被隐藏，`launcherFallback: 'ghost'` 会显示一个独立、不可拖拽且不入列表的恢复按钮，避免用户失去重新打开管理器的路径。

## 验证与质量信号

本版本新增 LifecycleScope、WidgetRegistry、ExpandPolicy 的单元测试。实际执行结果如下：

| 校验项 | 实测结果 | 覆盖范围 |
| --- | --- | --- |
| `npm run build` | 通过 | 三个浏览器 IIFE 产物生成 |
| `npm run test:unit` | 14 项通过 | 生命周期、注册契约、展开几何 |
| `npm run test:normalize` | 12 项 smoke 检查通过 | 状态归一化规则 |
| `npm run check:dist` | 通过 | 发行文件存在性与体积检查 |
| `npm run ci` | 通过 | build、unit、dist 校验 |
| GitHub Actions | v0.3 发布提交成功 | Node 20 环境下的基础门禁 |

构建后工作树保持干净，且 `dist/` 与 `site/dist/` 的三个 JS 产物 SHA-256 一致，说明源码、npm 分发物和站点演示分发物在本次发布时没有漂移。

## 兼容性与使用影响

v0.3 仍支持 v0.2 的 `registerHost` 方式，并保留单 Widget 与多 Widget IIFE 交付形态。使用者需要理解的新行为是：**隐藏不等于销毁**；若页面框架会卸载或重建宿主环境，应调用 `Orbit.destroy(id)`，而不是仅从 `ORBIT.widgets` 配置中移除它。

## 已知限制与建议

1. **Music Host 仍过于集中。** 其约 1,566 行，仍混合歌单、音频、DOM、布局、手势、持久化和 PJAX。下一阶段宜拆分 Playlist、Audio、Template/Portal 和 Interaction 边界。

2. **CI 少跑了一层。** 工作流执行 `test:unit`，但未调用完整的 `npm test`，因此当前没有自动跑 `test:normalize`。应将 CI 改为完整测试命令，并补充浏览器级的 `destroy → remount`、portal 清理和移动端长按回归。

3. **迁移文档需补齐。** Release 说明指向 `docs/MIGRATION-v0.3.md`，但标签中不存在该文件。应提供实际迁移指南，解释 destroy/visible 的语义变化。

4. **包入口需更明确。** `main` 当前指向会自启动的浏览器 IIFE；如果要支持 npm import，应增加 ESM/CJS 入口，否则需在文档中明确其浏览器脚本定位。