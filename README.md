# 余烬深渊 · Emberfall

一个使用 Three.js 制作的球形开放世界 3D 动作 RPG 原型。所有模型、场景纹理和特效均由代码生成，不依赖 Blender 或外部游戏素材。

## 在线试玩

- GitHub Pages：<https://15257988874.github.io/emberfall-rpg/>（首次部署需要先启用 Pages）
- 源代码：<https://github.com/15257988874/emberfall-rpg>

## 启动

最简单的方式是双击 `启动游戏.cmd`。

也可以在项目目录打开 PowerShell：

```powershell
npm run dev
```

然后访问 <http://127.0.0.1:5173/>。

## 操作

- 点击地面：移动
- 点击敌人：锁定并自动释放火矢
- WASD：步行移动
- Shift + WASD：奔跑；点击远处时也会自动奔跑
- 空格：攻击最近的敌人
- Q：吟唱余烬震环，造成范围伤害和击退
- E：裂隙步，向鼠标方向闪现
- F：吟唱铜卫结界，获得护盾
- R：使用疗愈药剂
- Esc：暂停
- 右上角 ♫：开启或关闭音乐与音效

## 当前内容

- 程序化低多边形英雄、敌人、球体地表和特效
- Web Audio 程序生成的原创循环配乐；首次进入游戏后自动开始
- 普攻、技能吟唱与释放、物理/魔法受击、掉落、升级和 BOSS 预警音效
- 浮动原点驱动的球面开放地图，可持续向任意方向探索
- 四类程序化生态区域；区域净化后会在 24–58 秒内随机重生
- 近战爬兽与蛮兵、魔法远程幽魂、物理远程猎手，以及区域霸主
- BOSS 交替释放大范围物理震击和近乎全屏的魔法风暴
- 普通攻击、技能强度、生命、护甲、魔抗和攻速均可持续成长
- 普通、稀有、史诗、传说四档随机装备掉落，装备等级随区域威胁成长
- 敌人生命、伤害、防御和数量随探索距离、净化次数及玩家等级成长
- 等级、经验、余烬、药剂、装备与球面坐标自动存档
- 自适应 HUD 和小地图
- 程序化关节动画：待机、步行、奔跑、普攻、吟唱、施法和闪现
- 多阶段技能特效：地面法阵、环绕粒子、能量柱、投射物轨迹和残影
- 单局排行榜与累计积分榜
- 在线成绩提交失败时自动回退到当前设备的本地榜

## 积分规则

| 行为 | 积分 |
| --- | ---: |
| 击败锈牙爬兽 | 80 |
| 击败蚀光幽魂 | 100 |
| 击败腐弦猎手 | 130 |
| 击败铸渣蛮兵 | 160 |
| 击败守门 Boss | 1,200 |
| 净化区域 | 300 + 已净化次数 × 50 |
| 每净化三个区域 | 2,000 |

“单局排行榜”比较每位玩家的一局最高分；“累计积分榜”累加同一玩家各局中新获得的积分。同一局重复提交只累计新增的部分。

榜单仅提交玩家自行输入的旅者名、随机生成的设备玩家 ID，以及击杀和通关统计；不收集账号密码、邮箱或付款信息。

## 打包

```powershell
npm run build
```

打包结果位于 `dist` 文件夹。

GitHub Pages 会在 `main` 分支更新后通过 `.github/workflows/deploy-pages.yml` 自动构建和发布。

## 上传到 GitHub 并触发 Actions

以下流程适用于大多数使用 GitHub Actions 发布的 Vite 静态站点。将命令中的占位符替换为自己的 GitHub 用户名、仓库名和本地项目目录。

### 1. 准备本地项目

安装 Git 和 Node.js，确认项目根目录包含 `package.json`、锁文件（例如 `package-lock.json`）以及 `.github/workflows/` 下的工作流文件。首次部署前建议在本地运行测试；构建命令由 Actions 在云端执行。

```bash
cd /path/to/your-project
git status
npm install
```

不要把密码、访问令牌、SSH 私钥、`.env` 或其他敏感配置提交到仓库。运行 `git status` 时应确认这些文件未被加入暂存区。

### 2. 创建 GitHub 仓库

在 <https://github.com/new> 创建仓库，记下仓库地址，例如：

```text
https://github.com/<github-user>/<repository>.git
```

创建空仓库时不要自动添加 README、`.gitignore` 或 License，避免与已有本地项目产生首次提交冲突。仓库可以选择 Public 或 Private；GitHub Pages 的可用性取决于账号方案和仓库设置。

### 3. 初始化并上传代码

如果项目还不是 Git 仓库，执行：

```bash
git init -b main
git add .
git commit -m "Initial release"
```

添加远程仓库并推送 `main` 分支：

```bash
git remote add origin git@github.com:<github-user>/<repository>.git
# 也可以使用 HTTPS：
# git remote add origin https://github.com/<github-user>/<repository>.git
git push -u origin main
```

后续修改只需要提交并推送：

```bash
git add .
git commit -m "Update game"
git push
```

SSH 推送需要在 GitHub 账户的 **Settings → SSH and GPG keys** 添加公钥；HTTPS 推送需要使用 GitHub 推荐的凭据管理方式或 Personal Access Token。不要把 Token 直接写进远程 URL 或脚本。

### 4. 配置 GitHub Pages

1. 打开仓库的 **Settings → Pages**。
2. 在 **Build and deployment → Source** 中选择 **GitHub Actions**。
3. 确认工作流文件已经提交到 `.github/workflows/`，并且工作流拥有 `pages: write` 与 `id-token: write` 权限。

本项目使用的工作流文件是 `.github/workflows/deploy-pages.yml`。它会执行 `npm ci`、`npm run build`，上传 `dist` 构建产物，再调用 `actions/deploy-pages` 发布站点。

### 5. 触发与查看 Actions

推送到 `main` 会自动触发工作流。也可以在仓库的 **Actions** 页面选择目标工作流，点击 **Run workflow** 手动触发；失败后使用 **Re-run all jobs** 重试。

验收时依次确认：

- `build` 作业中的依赖安装和构建步骤为绿色。
- `deploy` 作业成功完成，并显示 Pages 地址。
- **Settings → Pages** 显示已发布环境。
- 访问 `https://<github-user>.github.io/<repository>/` 能加载首页，浏览器控制台没有资源 404。

### 常见问题

| 现象 | 处理方式 |
| --- | --- |
| `Configure Pages` 失败 | 先在 **Settings → Pages** 将 Source 设为 **GitHub Actions**，再重新运行工作流。 |
| `npm ci` 失败 | 确认锁文件已提交，并让锁文件与 `package.json` 保持同步。 |
| 页面打开但 JS/CSS 404 | Vite 项目设置正确的 `base`；仓库 Pages 通常需要使用相对路径或 `/<repository>/` 前缀。 |
| 推送时提示认证失败 | 检查 SSH 公钥是否添加到当前账号，或重新配置 GitHub HTTPS 凭据；不要提交私钥或 Token。 |
| Actions 没有运行 | 确认工作流位于默认分支的 `.github/workflows/`，并检查 Actions 是否被仓库或组织禁用。 |

## 第二阶段美术垂直切片

- Blender 原创角色“星炉旅者”和远程怪“铜绿灯豺”已接入游戏。
- 主角包含待机、步行、奔跑、火矢、震环、冲刺、结界、受击与死亡动作。
- 铜绿灯豺包含待机、步行、奔跑、左右侧移、瞄准、齐射、受击、破甲与死亡动作。
- GLB 使用 Three.js 四阶卡通材质渲染；资源加载失败时会自动显示原程序化模型。
- 可重复构建脚本位于 `tools/blender/build_phase2_assets.py`，Blender 源文件和预览位于 `art/phase2/`。
