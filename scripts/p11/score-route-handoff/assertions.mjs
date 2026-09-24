function traceFacts(entry) {
  const { trace } = entry;
  const firstReady = trace.visualReadyAt;
  const beforeReady = trace.frames.filter((frame) => firstReady == null || frame.t < firstReady);
  const sourceHeld = beforeReady.every((frame) => {
    const surface = frame.surfaces.find((item) => item.name === entry.source);
    return surface?.exists && surface.visible && surface.opacity >= .98;
  });
  const emptyFrames = trace.frames.filter((frame) => frame.foregrounds.length === 0).length;
  const doubleInteractive = trace.frames.filter((frame) => frame.surfaces.filter((surface) =>
    surface.exists && surface.visible && surface.opacity > .2 && !surface.inert && surface.pointer).length > 1).length;
  const coreIds = new Set(trace.frames.map((frame) => frame.coreId).filter(Boolean));
  const canvasSignatures = new Set(trace.frames.map((frame) => frame.canvasIds.join(',')));
  const first = trace.frames[0], last = trace.frames.at(-1);
  return { visualReady: firstReady != null, settled: trace.settledAt != null,
    revealAfterReady: trace.revealStartAt != null && firstReady != null && trace.revealStartAt >= firstReady,
    sourceHeldUntilReady: sourceHeld, emptyFrames, doubleInteractive,
    blankVideoFrames: entry.screencast.blanks, finalPath: last?.path ?? null,
    identity: { coreIds: [...coreIds], canvasSignatures: [...canvasSignatures],
      coreStable: coreIds.size === 1, canvasStable: canvasSignatures.size === 1 },
    resourceDelta: first && last ? {
      contexts: last.contexts - first.contexts, framebuffers: last.framebuffers - first.framebuffers,
      raf: last.resources.raf - first.resources.raf, listeners: last.resources.listeners - first.resources.listeners,
      fetch: last.resources.fetch, audio: last.resources.audio, sources: last.resources.sources,
      scoreFetch: (last.resources.scoreFetchUrls ?? []).length,
    } : null,
    sceneOwners: [...new Set(trace.frames.map((frame) => frame.sceneOwner).filter(Boolean))],
    maxAnchors: Math.max(0, ...trace.frames.map((frame) => frame.anchors)),
  };
}

export function summarize(entries, writes, errors, strict = false) {
  const routes = Object.fromEntries(entries.map((entry) => [entry.label, traceFacts(entry)]));
  const baselineChecks = {
    threeDirectionsCaptured: new Set(entries.map((entry) => `${entry.source}->${entry.target}`)).size === 3,
    coldCaptured: entries.some((entry) => entry.cold?.releaseReason === 'controlled-delay'),
    viewTransitionVariants: entries.some((entry) => entry.viewTransition === 'supported')
      && entries.some((entry) => entry.viewTransition === 'disabled'),
    readOnly: writes.length === 0,
    noVideoBlank: Object.values(routes).every((route) => route.blankVideoFrames === 0),
  };
  const futureChecks = {
    visualReady: Object.values(routes).every((route) => route.visualReady),
    settled: Object.values(routes).every((route) => route.settled),
    revealAfterReady: Object.values(routes).every((route) => route.revealAfterReady),
    sourceHeldUntilReady: Object.values(routes).every((route) => route.sourceHeldUntilReady),
    noEmptyFrames: Object.values(routes).every((route) => route.emptyFrames === 0),
    oneInteractiveOwner: Object.values(routes).every((route) => route.doubleInteractive === 0),
    persistentCore: Object.values(routes).every((route) => route.identity.coreStable
      && route.identity.canvasStable && route.resourceDelta?.contexts === 0
      && route.resourceDelta?.framebuffers === 0),
    resourcesSettled: entries.filter((entry) => entry.target !== 'score').every((entry) => {
      const resource = routes[entry.label].resourceDelta;
      return resource && resource.scoreFetch === 0 && resource.audio === 0 && resource.sources === 0;
    }),
  };
  const passed = Object.values(baselineChecks).every(Boolean)
    && (!strict || Object.values(futureChecks).every(Boolean));
  return { strict, routes, baselineChecks, futureChecks, errors, passed };
}
