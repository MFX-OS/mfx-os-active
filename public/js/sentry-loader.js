(function() {
  var dsn = window.MFX_SENTRY_DSN || '';
  if (!dsn) return;
  var s = document.createElement('script');
  s.src = 'https://browser.sentry-cdn.com/8.0.0/bundle.min.js';
  s.crossOrigin = 'anonymous';
  s.onload = function() {
    if (window.Sentry) {
      Sentry.init({
        dsn: dsn,
        environment: location.hostname.includes('localhost') ? 'development' : 'production',
        release: 'mfx-os@3.0.0',
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0.5,
        beforeSend: function(event) {
          if (event.message && event.message.indexOf('AudioContext') >= 0) return null;
          return event;
        }
      });
    }
  };
  document.head.appendChild(s);
})();
