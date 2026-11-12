/* Presentation only. Native popup lifetime, key handling, volume writes,
 * restrictions, mute handling and TTS remain in the vendor components.
 * An ARC number is opt-in after checking the native CEC reporting capability.
 */
(function (root) {
  "use strict";
  var CEC_VOLUME = "kilby.sl2.i32.sound.cec.volume";
  function percent(value) {
    return typeof value === "number" && isFinite(value) && value >= 0 && value <= 100 ? Math.round(value) : null;
  }
  function audioStatus() {
    var result = { connected: false, supported: false, cec: null, main: null, arc: false };
    try {
      var biz = root._V_SDK_.biz;
      result.arc = biz.volume.getMainVolumeDev().value === biz.volume.MODELJS_DEFINE.ARC_DEV &&
        biz.sound.getAudioSpeaker().value === biz.sound.MODEJS_DEFINE.AUDIO_SPEAKER_ARC;
      result.connected = biz.sound.getArcDevExist().value === 1;
      result.main = percent(biz.volume.getMainVolumeState().value);
      result.supported = !!(root.modeljs && root.modeljs.isBizSupported(CEC_VOLUME));
      if (result.supported && result.arc && result.connected) result.cec = percent(biz.sound.getEZPlayCECVolumeState().value);
    } catch (_) { /* An unavailable service must never break the volume popup. */ }
    return result;
  }
  function render(h, directional, muted) {
    var vm = this, scale = (root.innerWidth || 1920) / 1920;
    var status = audioStatus();
    var arc = vm.kind === "ARC" || status.arc;
    var value = directional ? null : percent(vm.currVolume);
    // The native RC component also handles multiple Bluetooth devices. Never
    // mistake its primary-device number for a soundbar or aggregate percentage.
    if (arc) value = root.AlvidaaCecPercentEnabled === true && status.arc && status.connected && status.supported ? status.cec : null;
    if (muted) value = null;
    var label = arc ? "Barra HDMI" : /bluetooth/i.test(vm.icon || "") ? "Audio Bluetooth" : /earphone/i.test(vm.icon || "") ? "Auriculares" : directional ? "Audio externo" : "Volumen de TV";
    var message = muted ? "Silencio" : value !== null ? value + " %" : vm.isPlus ? "+" : vm.isMinus ? "−" : "Volumen";
    function box(x, y, w, height, extra) {
      var out = { position: "absolute", boxSizing: "border-box", left: x * scale + "px", top: y * scale + "px", width: w * scale + "px", height: height * scale + "px" };
      Object.keys(extra || {}).forEach(function (key) { out[key] = extra[key]; });
      return out;
    }
    function text(x, y, w, size, str, color) {
      return h("div", { style: box(x, y, w, size * 1.3, { color: color, fontSize: size * scale + "px", lineHeight: "1.25" }) }, [str]);
    }
    var children = [
      h("div", { style: box(27, 33, 54, 35, { border: 2 * scale + "px solid #b7caff", borderRadius: 9 * scale + "px" }) }, [
        h("div", { style: box(8, 14, 34, 3, { backgroundColor: "#b7caff", borderRadius: 2 * scale + "px" }) })
      ]),
      text(104, 27, 290, 23, label, "#bac9e9"),
      text(104, 67, 290, 43, message, "#f5f7ff")
    ];
    if (!muted && value !== null) {
      children.push(h("div", { style: box(28, 139, 364, 6, { backgroundColor: "#33415f", borderRadius: 3 * scale + "px", overflow: "hidden" }) }, [
        h("div", { style: { width: "100%", height: "100%", backgroundColor: "#b8ceff", transformOrigin: "0% 50%", transform: "scaleX(" + value / 100 + ")", transition: "transform 140ms ease-out" } })
      ]));
    } else if (!muted) children.push(text(28, 140, 364, 19, "Control de volumen HDMI".replace("HDMI", arc ? "HDMI" : "externo"), "#bac9e9"));
    return h("transition", { attrs: { name: "fade" } }, [h("div", {
      attrs: { role: "status", "aria-label": label + ": " + message },
      style: { position: "fixed", right: 72 * scale + "px", bottom: 66 * scale + "px", width: 420 * scale + "px", height: 184 * scale + "px",
        boxSizing: "border-box", borderRadius: 24 * scale + "px", border: scale + "px solid #516080", backgroundColor: "rgba(14,23,45,0.98)",
        color: "#f5f7ff", fontFamily: "Arial, sans-serif", transition: "opacity 160ms ease-out, transform 160ms ease-out", pointerEvents: "none" }
    }, children)]);
  }
  root.AlvidaaVolumeVisual = { render: render, audioStatus: audioStatus, percent: percent };
}(self));
