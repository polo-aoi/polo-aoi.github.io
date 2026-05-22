# AoiStitcher v1.3.1：新增 Windows 与 Intel Mac 支持

<div class="meta">Published on Jan 01, 2026</div>

新年好，v1.3.1 版本已推送到 GitHub。

这次更新主要响应了后台关于兼容性的反馈，补充了非 M 芯片 Mac 和 Windows 平台的构建版本。

## 更新内容

### 1. 新增 Windows 支持
提供了 `_Win.zip` 版本。解压后直接运行即可，已在 Windows 10/11 环境下测试通过。

### 2. 新增 Intel Mac 支持
提供了 `_Intel.dmg` 版本。适用于老款使用 Intel 芯片的 MacBook。

> **注意**：Mac 用户首次打开如果提示“文件已损坏”或“无法打开”，这是因为应用未签名。请在终端（Terminal）执行以下命令修复：
> `xattr -cr /Applications/AoiStitcher.app`

***
**GitHub 地址：** [AoiStitcher v1.3.1 Releases](https://github.com/polo-aoi/aoiStitcher/releases/tag/v1.3.1)

**下载指引：**
* **M芯片 Mac**: 下载 `AoiStitcher_M.dmg`
* **Intel Mac**: 下载 `AoiStitcher_Intel.dmg`
* **Windows**: 下载 `AoiStitcher_Win.zip`