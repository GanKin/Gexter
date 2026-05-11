<div align="center">

# Gexter 🤖

**新一代 AI 智能体框架 - 让 AI 像人类一样思考、规划和执行**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.3-black)](https://nextjs.org/)
[![Bun](https://img.shields.io/badge/Bun-1.0-FFC533)](https://bun.sh)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

[English](./README.md) | [简体中文](./README_CN.md)

</div>

---

## ✨ 核心亮点

| 特性 | 说明 |
|------|------|
| 🧠 **智能规划** | 自动将复杂问题分解为可执行的任务步骤 |
| 🔁 **自验证循环** | 执行后检查结果，自动迭代优化直至完成 |
| 💰 **金融级数据** | 集成机构级财务数据源，支持美股分析 |
| 🌐 **多渠道接入** | WebUI + WhatsApp，随时随地与 AI 交互 |
| 🔧 **可扩展工具** | 模块化工具系统，轻松扩展新功能 |
| 🐳 **开箱即用** | Docker 一键部署，无需复杂配置 |

---

## 🎯 为什么选择 Gexter？

### 1. 真正的"思考"能力
不同于简单的问答机器人，Gexter 具备：
- **任务规划**：将复杂查询自动拆解为研究步骤
- **工具选择**：智能选择合适的工具完成任务
- **结果验证**：检查工作成果，迭代改进答案

### 2. 专注金融研究
内置专业金融数据工具：
- 财务报表（利润表、资产负债表、现金流量表）
- 实时股价与市场数据
- 财报文件解析与提取
- 股票筛选与基本面分析
- 内部交易与新闻数据

### 3. 灵活的部署方式
```
┌─────────────────┐     ┌─────────────────┐
│   Web 界面      │     │   WhatsApp      │
│  (Next.js 15)   │     │   Gateway       │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │   Gexter    │
              │   Core      │
              └──────┬──────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼───┐      ┌────▼───┐     ┌─────▼────┐
│ LLMs  │      │ Tools  │     │ Memory   │
│(多家) │      │ (模块化)│     │  (持久化)│
└───────┘      └────────┘     └──────────┘
```

### 4. 丰富的工具生态
| 工具类别 | 功能 |
|---------|------|
| 💰 金融 | 财报、股价、新闻、筛选 |
| 🌐 网页 | 抓取、浏览、搜索 |
| 📁 文件 | 读取、编辑、搜索 |
| 🧠 记忆 | 长期记忆、每日笔记 |
| ⏰ 调度 | Cron 任务、心跳检测 |

---

## 🚀 快速开始

### 方式一：Docker 部署（推荐）

```bash
# 1. 克隆仓库
git clone https://github.com/yourusername/gexter.git
cd gexter

# 2. 配置环境变量
cp env.example .env
# 编辑 .env，填入你的 API 密钥

# 3. 启动服务
docker-compose up -d

# 4. 访问 WebUI
open http://localhost:3000
```

### 方式二：本地开发

```bash
# 1. 安装 Bun（如果未安装）
curl -fsSL https://bun.sh/install | bash

# 2. 安装依赖
bun install

# 3. 配置环境变量
cp env.example .env
# 编辑 .env

# 4. 启动开发服务器
bun run webui:dev

# 5. 访问
open http://localhost:5173
```

---

## 📦 环境配置

```bash
# .env 文件配置示例

# === LLM 提供商（至少配置一个） ===
OPENAI_API_KEY=sk-xxx              # OpenAI (GPT-4, GPT-5)
ANTHROPIC_API_KEY=sk-ant-xxx       # Anthropic (Claude)
GOOGLE_API_KEY=xxx                 # Google (Gemini)
XAI_API_KEY=xxx                    # xAI (Grok)
OPENROUTER_API_KEY=xxx             # OpenRouter

# === 金融数据源 ===
FINANCIAL_DATASETS_API_KEY=xxx     # 机构级财务数据（推荐）

# === 网页搜索 ===
EXASEARCH_API_KEY=xxx              # Exa 搜索（推荐）
TAVILY_API_KEY=xxx                 # Tavily 搜索（备选）

# === 本地模型（可选） ===
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

---

## 💡 使用示例

### 金融研究
```
你: 分析 Apple (AAPL) 近三年的盈利能力趋势

Gexter:
[规划] 执行以下步骤：
1. 获取 Apple 近三年利润表
2. 计算毛利率、净利率变化
3. 分析收入增长趋势
4. 总结盈利能力评估

[执行] 正在获取财务数据...
[完成] Apple 毛利率从 2021 年的 42.5% 稳定增长至 2023 年的 45.9%...
```

### 网页研究
```
你: 总结最近一周关于 AI 行业的重要新闻

Gexter:
[搜索] 正在搜索 AI 行业新闻...
[分析] 已找到 15 篇相关文章
[总结] 本周 AI 行业热点：
1. OpenAI 发布 GPT-5 预览版...
2. Claude 推出 iOS 原生应用...
3. Google Gemini 宣布企业版降价...
```

---

## 🏗️ 项目结构

```
gexter/
├── src/
│   ├── agent/          # AI 智能体核心
│   │   ├── index.ts    # 主 Agent 类
│   │   ├── prompts.ts  # 系统提示词
│   │   └── scratchpad.ts # 执行日志
│   ├── tools/          # 工具生态
│   │   ├── finance/    # 金融工具
│   │   ├── browser/    # 网页工具
│   │   ├── filesystem/ # 文件工具
│   │   └── memory/     # 记忆工具
│   ├── gateway/        # WhatsApp 网关
│   ├── webui/          # Web 界面
│   └── memory/         # 记忆存储系统
├── docker-compose.yml  # Docker 编排
├── Dockerfile          # 镜像构建
└── package.json
```

---

## 🔧 核心命令

```bash
# === 核心服务 ===
bun start              # 启动 CLI 模式
bun run webui:dev      # 启动 WebUI 开发模式
bun run gateway        # 启动 WhatsApp 网关

# === 开发工具 ===
bun run typecheck      # TypeScript 类型检查
bun test               # 运行测试
bun test:watch         # 监听模式测试

# === 构建部署 ===
bun run webui:build    # 构建 Next.js 应用
docker-compose up -d   # Docker 部署

# === 评估系统 ===
bun run src/evals/run.ts              # 运行完整评估
bun run src/evals/run.ts --sample 10  # 抽样评估
```

---

## 📱 WhatsApp 集成

通过 WhatsApp 与 Gexter 对话：

```bash
# 1. 登录 WhatsApp（扫码）
bun run gateway:login

# 2. 启动网关
bun run gateway

# 3. 给自己发消息，开始对话！
```

支持功能：
- ✅ 单聊对话
- ✅ 群组 @ 机器人
- ✅ 多账号管理
- ✅ 消息队列

---

## 🧪 评估系统

Gexter 内置评估框架，使用 LangSmith 跟踪和 LLM-as-judge 评分：

```bash
# 运行评估
bun run src/evals/run.ts

# 输出示例
╔═══════════════════════════════════════╗
║         Gexter 评估报告               ║
╠═══════════════════════════════════════╣
║ 总题数: 50                            ║
║ 已完成: 42                            ║
║ 准确率: 89.3%                         ║
║ 平均用时: 12.5s                       ║
╚═══════════════════════════════════════╝
```

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Next.js 15, React 19, TailwindCSS |
| **后端** | Bun, Node.js |
| **AI/ML** | LangChain, OpenAI, Anthropic |
| **数据库** | PostgreSQL (ParadeDB) |
| **网页** | Playwright |
| **部署** | Docker, Docker Compose |

---

## 🤝 贡献指南

欢迎贡献！请遵循以下流程：

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request

**注意**：请保持 PR 小而专注，便于审查和合并。

---

## 📜 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 🌟 致谢

- [Claude Code](https://claude.com/claude-code) - AI 编程助手的灵感来源
- [Financial Datasets](https://financialdatasets.ai) - 机构级金融数据支持
- [LangChain](https://langchain.com) - 强大的 LLM 应用框架

---

<div align="center">

**如果这个项目对你有帮助，请考虑 ⭐ Star 支持！**

Made with ❤️ by [Your Name]

</div>
