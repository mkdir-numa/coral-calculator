/* ============================================
   ANALYTICS — PostHog, the same project the Members
   Club already reports to, so every Coral Tribe site
   lands in one dashboard. The key is PostHog's public
   project key: it's meant to sit in the browser.

   Same file in coral-tribe-website, coral-tribe-docs
   and coral-calculator. Change one, copy to all three.

   window.ctTrack("event_name", { props }) records a
   custom event; it's a no-op until PostHog loads and
   on localhost, so pages can call it freely.
============================================= */
(function () {
  var KEY = "phc_tBrXkSnykvCiUj7r4wRrwekjirdyWuqBBwXsXWTvmrqT";
  var HOST = "https://us.i.posthog.com";

  window.ctTrack = function (event, props) {
    try { if (window.posthog && window.posthog.capture) window.posthog.capture(event, props || {}); } catch (e) {}
  };

  // Local previews would only add noise to the numbers.
  if (/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname) || location.protocol === "file:") return;

  // PostHog's standard loader snippet (queues calls until array.js arrives).
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  window.posthog.init(KEY, { api_host: HOST, person_profiles: "identified_only" });

  // Which site a visit happened on, as a property on every event, so the
  // dashboard can split website / docs / rewards / members in one click.
  var host = location.hostname.replace(/^www\./, "");
  var site = host.indexOf("docs.") === 0 ? "docs"
    : host.indexOf("rewards.") === 0 ? "rewards"
    : host.indexOf("members.") === 0 ? "members"
    : "website";
  window.posthog.register({ site: site });
})();
