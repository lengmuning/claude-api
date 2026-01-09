# Claude API 反向代理 - Cloudflare Worker

一个用于代理访问 Anthropic Claude API 的 Cloudflare Worker 反向代理。

## 功能特性

- ✅ 完整代理 Claude API 所有端点
- ✅ 支持流式响应 (Server-Sent Events)
- ✅ 支持所有 HTTP 方法 (GET, POST, PUT, DELETE 等)
- ✅ 自动处理 CORS 跨域请求
- ✅ 保留原始请求头和响应头
- ✅ 隐藏客户端真实 IP 和地理位置信息
- ✅ 错误处理和友好的错误信息

## 部署步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

### 3. 部署 Worker

```bash
npm run deploy
```

### 4. 配置自定义域名

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages**
3. 找到刚刚部署的 `claude-api-proxy` Worker
4. 点击 **Settings** → **Triggers**
5. 在 **Custom Domains** 部分添加你的域名，例如：`claude-api.your-domain.com`

> **注意**：你的域名必须已经托管在 Cloudflare DNS 上。

## 使用方法

部署并配置域名后，将 Claude API 的请求地址替换为你的代理地址即可。

### 原始请求地址

```
https://api.anthropic.com/v1/messages
```

### 代理后的地址

```
https://claude-api.your-domain.com/v1/messages
```

### 代码示例

#### Python

```python
import requests

# 使用你的代理域名
PROXY_URL = "https://claude-api.your-domain.com"
API_KEY = "YOUR_CLAUDE_API_KEY"

response = requests.post(
    f"{PROXY_URL}/v1/messages",
    headers={
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    },
    json={
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1024,
        "messages": [
            {"role": "user", "content": "Hello, how are you?"}
        ]
    }
)

print(response.json())
```

#### JavaScript/Node.js

```javascript
const PROXY_URL = "https://claude-api.your-domain.com";
const API_KEY = "YOUR_CLAUDE_API_KEY";

const response = await fetch(`${PROXY_URL}/v1/messages`, {
  method: "POST",
  headers: {
    "x-api-key": API_KEY,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      { role: "user", content: "Hello, how are you?" }
    ],
  }),
});

const data = await response.json();
console.log(data);
```

#### cURL

```bash
curl -X POST "https://claude-api.your-domain.com/v1/messages" \
  -H "x-api-key: YOUR_CLAUDE_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

### 流式响应示例

```javascript
const PROXY_URL = "https://claude-api.your-domain.com";
const API_KEY = "YOUR_CLAUDE_API_KEY";

const response = await fetch(`${PROXY_URL}/v1/messages`, {
  method: "POST",
  headers: {
    "x-api-key": API_KEY,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    stream: true,  // 启用流式响应
    messages: [
      { role: "user", content: "Write a short story" }
    ],
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(decoder.decode(value));
}
```

#### Python 流式响应

```python
import requests

PROXY_URL = "https://claude-api.your-domain.com"
API_KEY = "YOUR_CLAUDE_API_KEY"

response = requests.post(
    f"{PROXY_URL}/v1/messages",
    headers={
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    },
    json={
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1024,
        "stream": True,
        "messages": [
            {"role": "user", "content": "Write a short story"}
        ]
    },
    stream=True
)

for line in response.iter_lines():
    if line:
        print(line.decode('utf-8'))
```

## 本地开发

```bash
# 启动本地开发服务器
npm run dev

# 查看实时日志
npm run tail
```

## 隐私保护

此代理会自动删除以下可能暴露客户端信息的请求头：

- `cf-connecting-ip` - 客户端真实 IP
- `cf-ipcountry` - 客户端国家代码
- `cf-region` / `cf-region-code` - 客户端地区信息
- `cf-timezone` - 客户端时区
- `x-forwarded-for` / `x-real-ip` - 代理转发的客户端 IP
- 其他 Cloudflare 和代理相关头

这确保了 Claude API 服务器只能看到来自 Cloudflare 边缘节点的请求信息。

## 常见问题

### Q: 为什么需要自定义域名？

A: Cloudflare Workers 的默认域名 `*.workers.dev` 在某些地区可能无法访问。使用自定义域名可以确保正常访问。

### Q: 如何确保我的域名能正常访问？

A: 确保你的域名：
1. 已托管在 Cloudflare DNS
2. 开启了 Cloudflare 代理（橙色云朵图标）
3. 建议使用 .com 等国际域名

### Q: 流式响应不工作怎么办？

A: 确保你的请求体中包含 `"stream": true` 参数，代理会自动检测并处理流式响应。

### Q: 支持哪些 Claude 模型？

A: 代理透传所有请求，支持 Claude API 的所有模型，包括：
- claude-sonnet-4-20250514
- claude-3-5-sonnet-20241022
- claude-3-opus-20240229
- claude-3-haiku-20240307
- 等等

## 许可证

MIT License
