const CONNECT_TIMEOUT_MS = 5_000;
const COMMAND_TIMEOUT_MS = 15_000;

function waitForOpen(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('CDP WebSocket 连接超时')), CONNECT_TIMEOUT_MS);
    const finish = (error) => {
      clearTimeout(timer);
      socket.removeEventListener('open', opened);
      socket.removeEventListener('error', failed);
      if (error) reject(error); else resolve();
    };
    const opened = () => finish();
    const failed = () => finish(new Error('CDP WebSocket 连接失败'));
    socket.addEventListener('open', opened, { once: true });
    socket.addEventListener('error', failed, { once: true });
  });
}

export async function connectCdp(cdpBase, siteBase) {
  const response = await fetch(`${cdpBase}/json`, { signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`CDP target 列表 HTTP ${response.status}`);
  const targets = await response.json();
  const target = targets.find((item) => item.type === 'page' && item.webSocketDebuggerUrl
    && (item.url === 'about:blank' || item.url.startsWith(siteBase)));
  if (!target) throw new Error(`无法在 ${cdpBase} 找到站点页面 target`);
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await waitForOpen(socket);

  let commandId = 0;
  let disconnected = false;
  const pending = new Map();
  const consoleErrors = [];
  const pageErrors = [];
  const rejectPending = (error) => {
    if (disconnected) return;
    disconnected = true;
    for (const waiter of pending.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    pending.clear();
  };
  socket.addEventListener('close', () => rejectPending(new Error('CDP WebSocket 已断开')));
  socket.addEventListener('error', () => rejectPending(new Error('CDP WebSocket 发生错误')));
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      clearTimeout(waiter.timer);
      return message.error
        ? waiter.reject(new Error(message.error.message))
        : waiter.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const detail = message.params.exceptionDetails;
      pageErrors.push(detail.exception?.description ?? detail.text ?? '页面异常');
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      consoleErrors.push(message.params.args.map((item) => item.value ?? item.description).join(' '));
    }
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      consoleErrors.push(message.params.entry.text);
    }
  });

  function send(method, params = {}, timeoutMs = COMMAND_TIMEOUT_MS) {
    if (disconnected || socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error(`CDP 不可用，无法执行 ${method}`));
    }
    const id = ++commandId;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP ${method} 超过 ${timeoutMs}ms`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
    });
  }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? '页面求值失败');
    return result.result.value;
  }
  function close() {
    rejectPending(new Error('CDP 客户端已关闭'));
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
  }
  return { send, evaluate, close, consoleErrors, pageErrors };
}
