(() => {
  const text = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };

  text("[data-host]", window.location.host || "local fixture");

  window.addEventListener("load", () => {
    const navigation = performance.getEntriesByType("navigation")[0];
    if (!navigation) return;

    const protocol = navigation.nextHopProtocol || "unknown";
    const ttfb = Math.max(0, navigation.responseStart - navigation.requestStart);
    const bytes = navigation.transferSize || navigation.encodedBodySize;

    text("[data-protocol]", protocol.toUpperCase());
    text("[data-ttfb]", `${Math.round(ttfb)} ms`);
    text("[data-transfer]", bytes ? `${Math.round(bytes / 1024)} KB` : "cached");
  }, { once: true });
})();
