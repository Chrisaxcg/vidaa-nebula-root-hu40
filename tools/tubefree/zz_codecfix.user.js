// ==UserScript==
// @name TubeFree codec fix (force H.264)
// @description Report VP9/AV1 as unsupported so YouTube TV falls back to AVC on odin webengine
// @match https://www.youtube.com/tv*
// @run-at document-start
// ==/UserScript==

(function () {
    try {
        if (!window.MediaSource || typeof MediaSource.isTypeSupported !== 'function') return;
        var orig = MediaSource.isTypeSupported.bind(MediaSource);
        var blocked = /vp9|vp09|av01|av1|opus/i;
        MediaSource.isTypeSupported = function (type) {
            try {
                if (type && blocked.test(type)) {
                    console.log('[TubeFree] codec blocked:', type);
                    return false;
                }
            } catch (e) {}
            return orig(type);
        };
        console.log('[TubeFree] codec fix active');
    } catch (e) {}
})();
