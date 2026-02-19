
# 圣芙蕾雅学院云端DNS加密服务中心

一个高性能的DNS over HTTPS (DoH)服务端应用，提供安全、快速的域名解析服务。采用蓝白萌系设计风格，提供直观的管理界面和强大的DNS解析功能。

## ✨ 功能特性

### 核心功能
- 🔐 **DNS over HTTPS (DoH)** - 符合RFC 8484标准，支持GET和POST请求方式
- ⚡ **高性能缓存** - 智能DNS缓存系统，遵循TTL规则，显著提升查询速度
- 🌍 **多上游DNS支持** - 支持多个上游DNS服务器配置，自动负载均衡
- 📊 **实时监控** - 实时查询统计、性能指标、缓存命中率监控
- 🔍 **DNS查询工具** - 内置查询测试工具，支持多种DNS记录类型
- 📝 **查询日志** - 详细的DNS查询日志记录和统计分析
- ⚙️ **灵活配置** - 可视化配置管理，支持自定义上游DNS服务器

### 界面特色
- 🎨 蓝白萌系设计风格
- 🌊 流畅的动画效果
- 📱 响应式布局，支持各种设备
- 🔒 安全的用户认证系统

## 🚀 快速开始

### 环境要求

- Node.js 18.x 或更高版本
- pnpm 包管理器（推荐）

### 安装步骤

1. **克隆项目**

```bash
git clone <repository-url>
cd v0-project
```

2. **安装依赖**

```bash
pnpm install
```

3. **运行开发服务器**

```bash
pnpm dev
```

4. **访问应用**

打开浏览器访问 [http://localhost:3000](http://localhost:3000)

### 默认登录信息

- **用户名**: `xiya`
- **密码**: `xiya50491`

> ⚠️ **安全提示**: 请在生产环境中修改默认密码！编辑 `/lib/auth.ts` 文件更改登录凭证。

## 📖 使用说明

### 1. 登录系统

访问应用后，使用默认凭证登录到管理面板。

### 2. 实时监控仪表盘

主仪表盘显示：
- DoH服务运行状态
- 总查询次数
- 平均响应时间
- 缓存命中率
- 实时查询图表

### 3. DNS查询测试

在"查询工具"标签页：
1. 输入要查询的域名
2. 选择DNS记录类型（A、AAAA、MX、TXT等）
3. 选择上游DNS服务器
4. 点击"查询"查看结果

### 4. 配置上游DNS服务器

在"配置管理"标签页：
1. 点击"编辑"按钮
2. 添加、删除或修改上游DNS服务器
3. 配置包括：
   - 服务器名称
   - DoH URL地址
   - 优先级设置
4. 点击"保存"应用配置

### 5. 查看日志和统计

在"日志统计"标签页查看：
- 历史查询记录
- 查询类型分布
- 热门域名统计
- 响应时间趋势

## 🔧 配置说明

### 上游DNS服务器配置

默认内置的上游DNS服务器：

| 名称 | DoH URL | 优先级 |
|------|---------|--------|
| Cloudflare DNS | https://1.1.1.1/dns-query | 1 |
| Google DNS | https://8.8.8.8/dns-query | 2 |
| Quad9 DNS | https://9.9.9.9/dns-query | 3 |

你可以通过界面添加自定义的DoH服务器，例如：
- Alibaba DNS: `https://223.5.5.5/dns-query`
- AdGuard DNS: `https://dns.adguard.com/dns-query`
- OpenDNS: `https://doh.opendns.com/dns-query`

### 缓存配置

DNS缓存设置位于 `/lib/dns-cache.ts`：
- 默认最大缓存条目：1000
- 自动遵循DNS响应的TTL值
- 支持手动清除缓存

## 🌐 客户端配置

### DoH端点地址

```
https://your-domain.com/api/dns-query
```

### 浏览器配置

**Chrome/Edge:**
1. 设置 → 隐私和安全 → 安全
2. 启用"使用安全DNS"
3. 选择"自定义"，输入你的DoH URL

**Firefox:**
1. 设置 → 常规 → 网络设置
2. 启用"通过HTTPS启用DNS"
3. 选择"自定义"，输入你的DoH URL

### 操作系统配置

**Windows 11:**
1. 设置 → 网络和Internet → 以太网/Wi-Fi
2. DNS服务器分配 → 编辑
3. 首选DNS加密：仅加密(HTTPS)
4. 输入你的DoH URL

**macOS:**
使用第三方工具如 DNSCrypt 或配置文件配置DoH

**Android:**
1. 设置 → 网络和互联网 → 私人DNS
2. 选择"私人DNS提供商主机名"
3. 输入你的域名

**iOS:**
通过配置描述文件安装DoH配置

## 🛠️ 开发

### 项目结构

```
v0-project/
├── app/                      # Next.js App Router
│   ├── api/                  # API路由
│   │   ├── auth/            # 认证相关API
│   │   ├── dns-query/       # DoH核心查询端点
│   │   ├── test-query/      # 测试查询API
│   │   ├── stats/           # 统计数据API
│   │   ├── logs/            # 日志API
│   │   └── settings/        # 设置API
│   ├── login/               # 登录页面
│   ├── page.tsx             # 主页面
│   ├── layout.tsx           # 根布局
│   └── globals.css          # 全局样式
├── components/              # React组件
│   ├── dashboard-stats.tsx  # 仪表盘统计
│   ├── dns-query-tool.tsx   # DNS查询工具
│   ├── query-logs.tsx       # 查询日志
│   ├── configuration-panel.tsx  # 配置面板
│   ├── animated-background.tsx  # 动画背景
│   └── ...
├── lib/                     # 工具库
│   ├── doh-service.ts       # DoH服务核心
│   ├── dns-cache.ts         # DNS缓存管理
│   ├── dns-stats.ts         # DNS统计
│   ├── dns-types.ts         # 类型定义
│   ├── auth.ts              # 认证工具
│   ├── settings-store.ts    # 设置存储
│   └── utils.ts             # 通用工具
└── package.json
```

### 技术栈

- **框架**: Next.js 16
- **UI库**: Shadcn/ui + Tailwind CSS v4
- **DNS处理**: dns-packet
- **语言**: TypeScript
- **运行时**: Node.js / Edge Runtime

### 构建部署

**开发环境:**
```bash
pnpm dev
```

**生产构建:**
```bash
pnpm build
pnpm start
```

**部署到Vercel:**
```bash
vercel deploy
```

## 🔒 安全性

- 实现了基于令牌的用户认证
- 客户端IP地址脱敏处理
- 输入验证防止恶意请求
- 防DNS放大攻击保护
- HTTPS加密传输

> ⚠️ **生产环境建议**:
> 1. 修改默认登录凭证
> 2. 实现更强的认证机制（如JWT、OAuth）
> 3. 添加速率限制
> 4. 配置CORS策略
> 5. 使用数据库持久化日志和配置

## 📊 性能优化

- DNS缓存减少上游查询
- 查询去重避免重复请求
- Edge Runtime全球加速
- 响应式数据加载
- 虚拟列表优化大数据展示

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

本项目采用 **GNU Affero General Public License v3.0 (AGPL-3.0)** 许可证。

### AGPL-3.0 许可证要点

- ✅ **商业使用** - 可以用于商业目的
- ✅ **修改** - 可以修改源代码
- ✅ **分发** - 可以分发原始或修改后的版本
- ✅ **专利授权** - 提供明确的专利授权
- ✅ **私人使用** - 可以私人使用和修改

**但需要遵守以下条件：**

- 📝 **公开源代码** - 必须公开修改后的源代码
- 📝 **相同许可证** - 衍生作品必须使用相同的AGPL-3.0许可证
- 📝 **状态说明** - 必须声明对原始代码的修改
- 📝 **网络使用视为分发** - 如果通过网络提供服务，必须向用户提供源代码访问权限（这是AGPL与GPL的主要区别）

### 完整许可证文本

```
Copyright (C) 2026 圣芙蕾雅学院云端DNS加密服务中心

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
```

完整的AGPL-3.0许可证文本请访问: https://www.gnu.org/licenses/agpl-3.0.html

### 网络使用条款

根据AGPL-3.0第13条规定：

> 如果您修改本程序并通过计算机网络向其他用户提供与修改版本交互的机会，您必须向这些用户提供一个合理的方式来获取对应的源代码，通过某个标准或习惯的软件复制方式，从网络服务器上免费获得。

这意味着：
- 如果您运营基于此代码的DoH服务，您必须向用户提供访问源代码的方式
- 您可以在界面上添加"获取源代码"链接指向您的代码仓库
- 即使您不分发软件，只是提供网络服务，仍需公开源代码

## 🙏 致谢

- 感谢所有开源项目和贡献者
- 使用了 Shadcn/ui 组件库
- DNS解析基于 dns-packet 库
- 部署于 Vercel 平台

## 📧 联系方式

如有问题或建议，欢迎通过以下方式联系：

- 提交 Issue
- 发送 Pull Request
- 邮件联系: [your-email@example.com]

---

**免责声明**: 本项目仅供学习和研究使用。在生产环境中使用前，请确保进行充分的安全评估和测试。

Made with ❤️ by 圣芙蕾雅学院
