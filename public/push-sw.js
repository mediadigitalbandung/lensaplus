/**
 * Backwards-compatibility shim for browsers that previously registered /push-sw.js.
 * New registrations use /sw.js directly (which combines offline caching + push).
 */
importScripts("/sw.js");
