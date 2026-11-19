const script = `
(function () {
  var current = document.currentScript;
  if (!current) {
    var found = document.querySelectorAll("script[data-key]");
    current = found[found.length - 1];
  }
  if (!current) return;
  var key = current.getAttribute("data-key");
  if (!key) return;
  var origin = new URL(current.src, window.location.href).origin;
  var lang = current.getAttribute("data-lang") === "en" ? "en" : "ro";
  if (document.getElementById("redline-launcher")) return;

  var button = document.createElement("button");
  button.id = "redline-launcher";
  button.type = "button";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", lang === "en" ? "Open chat" : "Deschide chatul");
  button.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483000;display:grid;place-items:center;width:60px;height:60px;border:1px solid #ececec;border-radius:14px;background:#fff;box-shadow:0 12px 30px -16px rgba(0,0,0,.45);cursor:pointer;";
  button.innerHTML = '<svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true"><rect x="13" y="8" width="11" height="48" fill="#E10600"/><path fill="#E10600" fill-rule="evenodd" d="M20 8h16.5C48.8 8 54 14.6 54 23.4 54 33.4 47.2 39.6 36 39.6H20V8zm9.2 8.4v15.2h6.2c5.2 0 8-2.8 8-7.6s-2.8-7.6-8-7.6h-6.2z"/><polygon points="26,34 37,34 52,56 39,56" fill="#E10600"/><rect x="7" y="28.6" width="52" height="3.2" rx="1.6" fill="#E10600"/></svg>';

  var frame = document.createElement("iframe");
  frame.id = "redline-frame";
  frame.title = lang === "en" ? "Chat" : "Chat";
  frame.src = origin + "/embed/" + encodeURIComponent(key) + "?lang=" + lang;
  frame.style.cssText = "position:fixed;right:20px;bottom:96px;z-index:2147483000;width:min(380px,calc(100vw - 24px));height:min(640px,calc(100vh - 120px));border:0;border-radius:24px;box-shadow:0 24px 70px -28px rgba(20,36,32,.55);background:#fffdf8;display:none;";

  var open = false;
  button.addEventListener("click", function () {
    open = !open;
    frame.style.display = open ? "block" : "none";
    button.setAttribute("aria-expanded", open ? "true" : "false");
  });

  document.body.appendChild(frame);
  document.body.appendChild(button);
})();
`;

export function GET() {
  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
