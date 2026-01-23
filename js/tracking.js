(function(){
  const KEY = "aham_events_v1";

  function getEvents(){
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch { return []; }
  }

  function pushEvent(evt){
    const events = getEvents();
    events.push({ ...evt, ts: new Date().toISOString() });
    localStorage.setItem(KEY, JSON.stringify(events));
  }

  // public API
  window.AhamTrack = {
    track: (name, props={}) => pushEvent({ name, props }),
    dump: () => getEvents(),        // view in console: AhamTrack.dump()
    clear: () => localStorage.removeItem(KEY)
  };
})();
