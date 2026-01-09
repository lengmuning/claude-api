/**
 * Cloudflare Worker - Claude API 反向代理
 * 
 * 功能：
 * 1. 完整代理 Anthropic Claude API 的所有端点
 * 2. 支持流式响应 (SSE)
 * 3. 支持所有 HTTP 方法
 * 4. 保留原始请求头和响应头
 * 5. 支持 CORS 跨域请求
 * 6. 隐藏客户端真实 IP 和地理位置信息
 */

// Claude API 的基础 URL
const CLAUDE_API_BASE = 'https://api.anthropic.com';

// CORS 基础响应头
const CORS_BASE_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Max-Age': '86400',
};

/**
 * 处理 CORS 预检请求
 */
function handleOptions(request) {
  const headers = new Headers();
  applyCorsHeaders(headers, request);
  return new Response(null, {
    status: 204,
    headers,
  });
}

/**
 * 生成并应用 CORS 响应头
 */
function applyCorsHeaders(headers, request) {
  const origin = request.headers.get('Origin') || '*';
  const reqHeaders = request.headers.get('Access-Control-Request-Headers');
  const allowHeaders = reqHeaders || '*';

  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Headers', allowHeaders);
  Object.entries(CORS_BASE_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });

  const varyValues = ['Origin', 'Access-Control-Request-Headers'];
  const existingVary = headers.get('Vary');
  const varyParts = existingVary
    ? existingVary.split(',').map((value) => value.trim()).filter(Boolean)
    : [];
  varyValues.forEach((value) => {
    if (!varyParts.includes(value)) {
      varyParts.push(value);
    }
  });
  headers.set('Vary', varyParts.join(', '));
}

/**
 * 主请求处理函数
 */
async function handleRequest(request) {
  const url = new URL(request.url);
  
  // 构建目标 URL - 保留原始路径和查询参数
  const targetUrl = new URL(url.pathname + url.search, CLAUDE_API_BASE);
  
  // 复制请求头，移除可能暴露客户端信息的头
  const headers = new Headers(request.headers);
  
  // 删除 Cloudflare 添加的客户端信息头
  headers.delete('host');
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ipcountry');
  headers.delete('cf-ray');
  headers.delete('cf-visitor');
  headers.delete('cf-region');
  headers.delete('cf-region-code');
  headers.delete('cf-metro-code');
  headers.delete('cf-postal-code');
  headers.delete('cf-timezone');
  
  // 删除代理相关头
  headers.delete('forwarded');
  headers.delete('x-forwarded-for');
  headers.delete('x-forwarded-proto');
  headers.delete('x-forwarded-host');
  headers.delete('x-real-ip');
  headers.delete('true-client-ip');
  
  // 构建代理请求选项
  const init = {
    method: request.method,
    headers: headers,
    redirect: 'follow',
  };
  
  // 对于有请求体的方法，转发请求体
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
    // 保持流式传输
    init.duplex = 'half';
  }
  
  try {
    // 发送请求到 Claude API
    const response = await fetch(targetUrl.toString(), init);
    
    // 复制响应头
    const responseHeaders = new Headers(response.headers);
    
    // 添加 CORS 头
    applyCorsHeaders(responseHeaders, request);
    
    // 检查是否是流式响应
    const contentType = response.headers.get('content-type') || '';
    const isStream = contentType.includes('text/event-stream') || 
                     contentType.includes('application/x-ndjson') ||
                     request.headers.get('accept')?.includes('text/event-stream') ||
                     (url.pathname.includes('/messages') && 
                      request.headers.get('content-type')?.includes('application/json'));
    
    // 检查请求体是否包含 stream: true
    let isStreamRequest = false;
    if (request.method === 'POST' && request.headers.get('content-type')?.includes('application/json')) {
      try {
        const clonedRequest = request.clone();
        const body = await clonedRequest.json();
        isStreamRequest = body.stream === true;
      } catch (e) {
        // 忽略解析错误
      }
    }
    
    if (isStream || isStreamRequest || contentType.includes('text/event-stream')) {
      // 对于流式响应，直接透传响应体
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }
    
    // 对于非流式响应，读取完整响应体后返回
    const body = await response.arrayBuffer();
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
    
  } catch (error) {
    // 错误处理
    return new Response(
      JSON.stringify({
        error: {
          message: `Proxy error: ${error.message}`,
          type: 'proxy_error',
        },
      }),
      {
        status: 502,
        headers: (() => {
          const headers = new Headers({ 'Content-Type': 'application/json' });
          applyCorsHeaders(headers, request);
          return headers;
        })(),
      }
    );
  }
}

/**
 * Worker 入口点
 */
export default {
  async fetch(request, env, ctx) {
    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }
    
    // 处理实际请求
    return handleRequest(request);
  },
};
