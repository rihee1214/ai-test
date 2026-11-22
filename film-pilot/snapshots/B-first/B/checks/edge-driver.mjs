import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export const origin = "http://127.0.0.1:4317";

export async function until(check, description, timeout = 7000) {
  const deadline = Date.now() + timeout;
  let lastError;
  do {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(60);
  } while (Date.now() < deadline);
  throw new Error("시간 초과 · " + description, { cause: lastError });
}

async function findEdge() {
  for (const root of [process.env["ProgramFiles(x86)"], process.env.ProgramFiles, process.env.LOCALAPPDATA]) {
    if (!root) continue;
    const exe = path.join(root, "Microsoft", "Edge", "Application", "msedge.exe");
    try { await access(exe); return exe; } catch { /* Try the next installation location. */ }
  }
  throw new Error("Windows에 설치된 Microsoft Edge를 찾을 수 없습니다.");
}

export async function launchEdge(profile, downloads) {
  const child = spawn(await findEdge(), [
    "--headless=new", "--disable-background-networking", "--disable-sync", "--disable-extensions",
    "--no-first-run", "--no-default-browser-check", "--disable-component-update",
    "--remote-debugging-port=0", "--remote-debugging-address=127.0.0.1",
    "--user-data-dir=" + profile, "--window-size=1280,800", "about:blank",
  ], { windowsHide: true, stdio: "ignore" });
  const exited = once(child, "exit");
  let socket;
  try {
    const url = await until(async () => {
      if (child.exitCode !== null) throw new Error("Edge 종료 코드 " + child.exitCode);
      const [port] = (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split(/\r?\n/);
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) });
      return (await response.json()).webSocketDebuggerUrl;
    }, "Edge 시작", 25000);
    socket = new WebSocket(url);
    await once(socket, "open");
  } catch (error) {
    if (child.exitCode === null) child.kill();
    throw error;
  }

  let sequence = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.exceptionThrown") {
      const info = message.params.exceptionDetails;
      errors.push(info.exception?.description ?? info.text);
    }
    if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
      errors.push(message.params.entry.text);
    }
    if (message.method === "Network.requestWillBeSent") {
      const url = message.params.request.url;
      if (/^https?:/.test(url) && new URL(url).origin !== origin) errors.push("외부 요청 " + url);
    }
    const task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id);
    clearTimeout(task.timer);
    if (message.error) task.reject(new Error(message.error.message));
    else task.resolve(message.result);
  });

  function send(method, params = {}, sessionId) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error("Edge 응답 시간 초과 · " + method)); }, 10000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, sessionId, method, params }));
    });
  }
  await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
  const { product } = await send("Browser.getVersion");

  async function page(hash) {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const call = (method, params) => send(method, params, sessionId);
    await Promise.all(["Runtime.enable", "Page.enable", "Log.enable", "Network.enable"].map((method) => call(method)));
    await call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await call("Page.navigate", { url: origin + "/#" + hash });

    async function evaluate(expression) {
      const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
      return result.result.value;
    }
    const element = (selector) => "document.querySelector(" + JSON.stringify(selector) + ")";
    const waitFor = (expression) => until(() => evaluate(expression), expression);
    const hasText = (selector, value) => waitFor(`${element(selector)}?.innerText.includes(${JSON.stringify(value)})`);

    async function click(selector) {
      await call("Page.bringToFront");
      const point = await until(() => evaluate(`(() => {
        const node = ${element(selector)};
        if (!node || node.disabled) return false;
        node.scrollIntoView({ block: "nearest", inline: "nearest" });
        const r = node.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        if (!node.contains(document.elementFromPoint(x, y))) return false;
        return { x, y };
      })()`), "클릭 " + selector);
      await call("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
      await call("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
    }
    async function fillTime(selector, value) {
      await evaluate(`(() => {
        const input = ${element(selector)};
        input.value = ${JSON.stringify(value)};
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      })()`);
    }
    async function screenshot(file) {
      const shot = await call("Page.captureScreenshot", { format: "png" });
      await writeFile(file, Buffer.from(shot.data, "base64"));
    }
    await waitFor("Boolean(document.querySelector('main h1'))");
    return { click, evaluate, fillTime, hasText, waitFor, screenshot };
  }

  async function close() {
    await send("Browser.close");
    await until(() => child.exitCode !== null || child.signalCode !== null, "Edge 정상 종료", 12000);
    await exited;
    socket.close();
  }
  return { page, close, errors, product };
}
