# SSE 流式通信 Bug 修复记录

**日期**：2026-02-08
**涉及文件**：
- `backend/app/services/session_service.py`
- `frontend/src/lib/api.ts`

---

## 背景

前后端通信打通后，后端 API 全部返回 200 OK，日志无任何报错，但前端页面上 AI 始终没有回复——用户发送消息后界面卡住，没有流式文字出现。

后端日志（正常）：

```
INFO: 127.0.0.1:49008 - "POST /api/sessions/.../issue HTTP/1.1" 200 OK
INFO: 127.0.0.1:49008 - "POST /api/sessions/.../stage2/chat HTTP/1.1" 200 OK
```

前端日志（无报错，也无任何 AI 内容）：

```
GET /chat 200 in 32ms
```

---

## 根因分析

排查后发现存在 **两个 Bug**，共同导致了前端完全接收不到 SSE 事件。

### Bug 1：SSE 双重编码

#### 问题描述

后端有两层在做 SSE 格式化，互相叠加：

**第一层**：`session_service._sse_event()` 手动拼接了完整的 SSE 文本：

```python
# session_service.py
def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
```

**第二层**：`sse_starlette` 的 `EventSourceResponse` 收到 generator yield 的字符串后，认为这是纯数据，按 SSE 规范再包一层 `data:` 前缀：

```python
# session.py (路由层)
return EventSourceResponse(_wrap_sse(session_service.stage2_chat(...)))
```

#### 实际发送到浏览器的内容

预期：
```
event: token
data: {"content": "你好"}

```

实际（被 EventSourceResponse 二次包装后）：
```
data: event: token
data: data: {"content": "你好"}
data:

```

#### 对前端的影响

前端 `parseSSE` 按行匹配 `event: ` 和 `data: ` 前缀：

```typescript
if (line.startsWith("event: ")) { ... }      // "data: event: token" → 不匹配
else if (line.startsWith("data: ")) { ... }   // 匹配，但取到的是 "event: token"
```

- `event` 始终是默认值 `"message"`，永远不等于 `"token"`
- `dataStr` 取到 `"event: token"`，`JSON.parse` 失败，回退到 `{ raw: "..." }`
- `consumeStream` 中 `if (evt.event === "token")` 永远不成立，所有 token 被跳过

#### 修复方式

改 `_sse_event()` 返回 dict，让 `EventSourceResponse` 负责格式化：

```python
# 修复前
def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

# 修复后
def _sse_event(event: str, data: dict) -> dict:
    return {"event": event, "data": json.dumps(data, ensure_ascii=False)}
```

`EventSourceResponse` 收到 dict 后会自动创建 `ServerSentEvent(event=..., data=...)` 并正确编码。

---

### Bug 2：换行符不兼容（`\r\n` vs `\n`）

#### 问题描述

修复 Bug 1 后，前端仍然没有反应。进一步排查发现 `sse-starlette` 的默认行分隔符是 `\r\n`（HTTP 标准），而非 `\n`。

验证方式：

```python
>>> from sse_starlette.sse import ServerSentEvent
>>> e = ServerSentEvent(data='{"content":"hi"}', event='token')
>>> repr(e.encode())
b'event: token\r\ndata: {"content":"hi"}\r\n\r\n'
```

#### 实际发送的字节

```
event: token\r\ndata: {"content":"hi"}\r\n\r\n
```

#### 对前端的影响

前端 `parseSSE` 用 `buffer.split("\n\n")` 切分事件边界：

```typescript
const parts = buffer.split("\n\n");
```

但 `\r\n\r\n` 中两个 `\n` 之间隔着一个 `\r`，不包含连续的 `\n\n`：

```
\r\n\r\n  →  字符序列: \r, \n, \r, \n
\n\n      →  字符序列: \n, \n
```

`split("\n\n")` 永远切不开，buffer 不断累积，`parseSSE` 永远不 yield 任何事件，`consumeStream` 的 `for await` 循环永远不执行迭代体。

最终，直到 SSE 连接关闭，`reader.read()` 返回 `{ done: true }`，循环结束。进入"处理剩余 buffer"的逻辑后，按 `\n` 切分行得到的是 `"event: token\r"`，与 `"token"` 比较仍然不匹配（多了 `\r`）。

#### 修复方式

解码后立即将 `\r\n` 统一为 `\n`：

```typescript
// 修复前
buffer += decoder.decode(value, { stream: true });

// 修复后
buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
```

---

## 修复总结

| Bug | 位置 | 原因 | 修复 |
|-----|------|------|------|
| 双重编码 | `backend/app/services/session_service.py` | `_sse_event()` 手动拼 SSE 文本 + `EventSourceResponse` 再包一层 | `_sse_event()` 改为返回 dict |
| 换行符不兼容 | `frontend/src/lib/api.ts` | `sse-starlette` 用 `\r\n`，前端 `split("\n\n")` 只认 `\n` | 解码后 `.replace(/\r\n/g, "\n")` |

两个 Bug 同时存在，任何一个单独都会导致前端完全无法解析 SSE 事件。

---

## 经验教训

1. **不要在库的上层重复做库本身的工作**。使用 `EventSourceResponse` 就应该让它负责 SSE 编码，service 层只 yield 结构化数据。
2. **HTTP 协议的换行符是 `\r\n`，不是 `\n`**。手写 SSE 解析器时必须兼容两者。`sse-starlette` 遵守 HTTP 标准用了 `\r\n`，这完全正确。
3. **后端返回 200 OK 不代表前端能正确消费响应体**。对于 SSE/流式响应，200 只表示响应头已发送，响应体的格式问题不会反映在状态码上。
4. **调试 SSE 时，浏览器 DevTools 的 Network 面板中查看 EventStream 标签页**，可以直接看到原始事件格式，能快速定位编码问题。
