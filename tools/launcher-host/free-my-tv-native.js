/* Free My TV native Cobalt frontend, adapted from felipericardo/tv-launcher
 * web/home.css and its offline clock/shelf design, revision f2d984c.
 * MIT: see third-party/free-my-tv/LICENSE and README.md.
 * Vue replaces the browser renderer. No canvas, CDN, or global CSS.
 *
 * r3: galaxy presentation. Stable remote-control geometry, visible app names,
 * scoped transform/opacity animation, reversible offline artwork. The existing
 * navigation, app ordering, storage and native platform methods are retained.
 */
(function (root) {
  "use strict";
  root.AlvidaaFreeMyTV = function (sdk) {
    var keys = sdk.key.KEYMAP;
    function id(app) { return String(app.appId); }
    function load() {
      try {
        var value = sdk.storage.get("alvidaa.freeMyTV");
        if (typeof value === "string") value = JSON.parse(value);
        return value && typeof value === "object" ? value : {};
      } catch (_) { return {}; }
    }
    var WMO = { 0: "Despejado", 1: "Casi despejado", 2: "Parcialmente nublado", 3: "Nublado",
      45: "Niebla", 48: "Niebla", 51: "Llovizna", 53: "Llovizna", 55: "Llovizna",
      61: "Lluvia ligera", 63: "Lluvia", 65: "Lluvia fuerte", 66: "Aguanieve", 67: "Aguanieve",
      71: "Nieve ligera", 73: "Nieve", 75: "Nieve fuerte", 77: "Nieve",
      80: "Chubascos", 81: "Chubascos", 82: "Chubascos fuertes",
      85: "Nevadas", 86: "Nevadas", 95: "Tormenta", 96: "Tormenta con granizo", 99: "Tormenta con granizo" };
    var GRID_COLS = 8;
    return {
      name: "Launcher",
      data: function () {
        var prefs = load();
        return { apps: [], sources: [], view: "home", zone: "shelf", index: 0,
          now: new Date(), width: root.innerWidth || 1920, status: "Starting native services…",
          theme: ["auto", "dark", "light"].indexOf(prefs.theme) >= 0 ? prefs.theme : "dark",
          favorites: Array.isArray(prefs.favorites) ? prefs.favorites.map(String) : null,
          hidden: Array.isArray(prefs.hidden) ? prefs.hidden.map(String) : [],
          appOrder: Array.isArray(prefs.appOrder) ? prefs.appOrder.map(String) : null,
          weather: null, moving: false, menu: null, visualActive: false, visualHidden: false };
      },
      mounted: function () { this.start(); this.startVisuals(); },
      activated: function () { this.start(); this.routeFocus(); this.startVisuals(); },
      deactivated: function () { this.stopVisuals(); this.stop(); },
      beforeDestroy: function () { this.stopVisuals(); this.stop(); },
      watch: { "$route": function () { this.routeFocus(); } },
      methods: {
        startVisuals: function () {
          this.visualActive = true;
          // Load scoped keyframes through the native stylesheet loader.
          if (!this._visualStyle && root.document && root.document.head && root.document.createElement) {
            var link = root.document.createElement("link");
            link.setAttribute("rel", "stylesheet");
            link.setAttribute("type", "text/css");
            link.setAttribute("href", "file:///hisenseUI/var/local/alvidaa-home-visual-v1.css");
            root.document.head.appendChild(link);
            this._visualStyle = link;
          }
          if (this._visualVisibility) return;
          var vm = this;
          this._visualVisibility = function () { vm.visualHidden = !!(root.document && root.document.hidden); };
          this._visualVisibility();
          if (root.document && root.document.addEventListener) root.document.addEventListener("visibilitychange", this._visualVisibility);
        },
        stopVisuals: function () {
          this.visualActive = false;
          if (this._visualStyle && this._visualStyle.parentNode) this._visualStyle.parentNode.removeChild(this._visualStyle);
          this._visualStyle = null;
          if (root.document && root.document.removeEventListener && this._visualVisibility) root.document.removeEventListener("visibilitychange", this._visualVisibility);
          this._visualVisibility = null;
        },
        reducedMotion: function () {
          // Some vendor builds match BOTH unknown media values. Only honor an
          // unambiguous preference, otherwise an unsupported query stops motion.
          try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches &&
            !root.matchMedia("(prefers-reduced-motion: no-preference)").matches); }
          catch (_) { return false; }
        },
        start: function () {
          if (this._running) return;
          this._running = true;
          var vm = this;
          this._platform = root.AlvidaaNativePlatform(sdk, function (data) {
            vm.apps = data.apps.filter(function (app) {
              return app && app.appId != null && typeof app.appName === "string" &&
                app.appName.trim() && id(app) !== "vidaa-home" && id(app) !== "206";
            });
            vm.sources = data.sources.filter(function (input) { return input && input.sourceId != null; });
            vm.status = data.errors.length ? data.errors.join("; ") :
              data.waiting ? "Waiting for TV data…" : "Native · " + vm.apps.length + " apps · " + vm.sources.length + " inputs";
            vm.clamp();
          });
          this._platform.start();
          this._clock = setInterval(function () { vm.now = new Date(); }, 1000);
          this._resize = function () { vm.width = root.innerWidth || 1920; };
          if (root.addEventListener) root.addEventListener("resize", this._resize);
          this.routeFocus();
          this.loadWeather();
          // Consume handled Home keys during bubbling, before document-level
          // defaults. Dialogs can consume them first; unrelated keys pass through.
          this._keyDown = function (event) {
            if (sdk.router.isCurrentPathEqualTo("/Launcher") && vm.handleKey(event.keyCode)) {
              event.stopPropagation();
              vm.announce();
            }
          };
          // Long-press OK: the press starts on key-down and resolves on key-up.
          // A short release selects; holding past 650ms opens the context menu.
          this._keyUp = function (event) {
            if (event.keyCode !== keys.ENTER || !vm._lp) return;
            var lp = vm._lp; vm._lp = null;
            clearTimeout(lp.t);
            if (!lp.fired && sdk.router.isCurrentPathEqualTo("/Launcher")) {
              vm.select();
              vm.announce();
            }
            event.stopPropagation();
          };
          if (root.document && root.document.body) {
            root.document.body.addEventListener("key-down", this._keyDown);
            root.document.body.addEventListener("key-up", this._keyUp);
          }
          root.AlvidaaNativeActive = this;
        },
        loadWeather: function () {
          var vm = this;
          if (typeof fetch !== "function") return;
          fetch("https://ipapi.co/json/").then(function (r) { return r.json(); }).then(function (geo) {
            if (!geo || geo.latitude == null) return null;
            var url = "https://api.open-meteo.com/v1/forecast?latitude=" + geo.latitude +
              "&longitude=" + geo.longitude + "&current=temperature_2m,weather_code&timezone=auto";
            return fetch(url).then(function (r) { return r.json(); }).then(function (wx) {
              if (wx && wx.current && wx.current.temperature_2m != null) {
                vm.weather = { temp: Math.round(wx.current.temperature_2m),
                  desc: WMO[wx.current.weather_code] || "", city: geo.city || "" };
              }
            });
          }).catch(function () { /* offline: no weather line */ });
          clearInterval(this._weatherT);
          this._weatherT = setInterval(function () { vm.loadWeather(); }, 30 * 60 * 1000);
        },
        announce: function () {
          if (!sdk.tts || !sdk.tts.isEnable() || !sdk.router.isCurrentPathEqualTo("/Launcher")) return;
          if (this.menu) { sdk.tts.speak(this.menu.opts[this.menu.sel].label); return; }
          var item = this.zone === "top" ? ["Home", "All apps", "Inputs", "TV Settings", "Preferences"][this.index] : this.list()[this.index];
          var label = typeof item === "string" ? item : item && (this.view === "inputs" ? this.sourceName(item) : item.appName);
          if (label) sdk.tts.speak((this.moving ? "Moving " : "") + label);
        },
        stop: function () {
          this._running = false;
          if (this._platform) this._platform.stop();
          clearInterval(this._clock);
          clearInterval(this._weatherT);
          if (root.document && root.document.body) {
            root.document.body.removeEventListener("key-down", this._keyDown);
            root.document.body.removeEventListener("key-up", this._keyUp);
          }
          if (root.removeEventListener) root.removeEventListener("resize", this._resize);
          if (root.AlvidaaNativeActive === this) root.AlvidaaNativeActive = null;
        },
        routeFocus: function () {
          var q = this.$route && this.$route.query || {};
          if (q.focusArea === "input" || Number(q.value) === keys.SOURCE || Number(q.value) === keys.KEYPAD_INPUT ||
              q.startLauncherFrom === sdk.apc.CMDMETHOD.KEY_INPUT_START) this.show("inputs");
          else { this.view = "home"; this.zone = "shelf"; this.index = 0; this.moving = false; this.menu = null; }
        },
        save: function () {
          try { sdk.storage.set("alvidaa.freeMyTV", { theme: this.theme, favorites: this.favorites, hidden: this.hidden, appOrder: this.appOrder }); }
          catch (error) { this.status = "Could not save preferences: " + error.message; }
        },
        localIcon: function (app) {
          var candidates = [app.img, app.presetImg, app.icon, app.appIcon];
          var icon = candidates.filter(function (value) {
            return typeof value === "string" && /^(var\/local\/storeAppIcon\/|file:\/\/\/|\/(?!\/)|data:image\/(png|jpeg|webp);base64,)/i.test(value);
          })[0] || "";
          return icon.indexOf("var/local/storeAppIcon/") === 0 ? "file:///hisenseUI/" + icon : icon;
        },
        sourceName: function (input) {
          var label = input.rename || input.name || String(input.sourceId);
          if (/^[A-Z]{2,4}[0-9]{4,}$/.test(label) && sdk.i18n && sdk.i18n.t) {
            try { var translated = sdk.i18n.t(label); if (translated && translated !== label) return translated; }
            catch { return input.name || label; }
            return input.name || label;
          }
          return label;
        },
        shelf: function () {
          var apps = this.apps;
          if (this.favorites === null) return apps.slice(0, 8);
          return this.favorites.map(function (key) {
            return apps.filter(function (app) { return id(app) === key; })[0];
          }).filter(Boolean);
        },
        visibleApps: function () {
          var hidden = this.hidden;
          var apps = this.apps.filter(function (app) { return hidden.indexOf(id(app)) < 0; });
          if (this.appOrder) {
            var pos = this.appOrder;
            apps = apps.slice().sort(function (a, b) {
              var pa = pos.indexOf(id(a)), pb = pos.indexOf(id(b));
              if (pa < 0) pa = pos.length; if (pb < 0) pb = pos.length;
              return pa - pb;
            });
          }
          return apps;
        },
        list: function () {
          if (this.view === "inputs") return this.sources;
          if (this.view === "apps") return this.visibleApps();
          if (this.view === "edit") return this.apps;
          if (this.view === "prefs") return ["TV Settings", "Theme: " + this.theme, "Manage shelf", "Reorder shelf", "Refresh apps & inputs", "About / licenses"];
          if (this.view === "about") return ["Back"];
          return this.shelf();
        },
        clamp: function () {
          var count = this.zone === "top" ? 5 : this.list().length;
          this.index = Math.max(0, Math.min(this.index, count - 1));
        },
        show: function (view) { this.view = view; this.zone = "shelf"; this.index = 0; this.moving = false; this.menu = null; },
        run: function (action) {
          var vm = this;
          try {
            var result = action();
            if (result && typeof result.then === "function") result.catch(function (error) { vm.status = "Action failed: " + error.message; });
          } catch (error) { this.status = "Action failed: " + error.message; }
        },
        openMenu: function () {
          var item = this.visibleApps()[this.index];
          if (!item) return;
          var isFav = this.shelf().map(id).indexOf(id(item)) >= 0;
          this.menu = { sel: 0, t: Date.now(), opts: [
            { label: "Mover", act: "move" },
            { label: isFav ? "Quitar de inicio" : "Fijar en inicio", act: "fav" },
            { label: "Ocultar", act: "hide" }
          ] };
        },
        menuSelect: function () {
          var item = this.visibleApps()[this.index];
          var opt = this.menu && this.menu.opts[this.menu.sel];
          this.menu = null;
          if (!item || !opt) return;
          if (opt.act === "move") { this.moving = true; return; }
          if (opt.act === "hide") {
            if (this.hidden.indexOf(id(item)) < 0) this.hidden.push(id(item));
            this.save(); this.clamp(); return;
          }
          if (opt.act === "fav") {
            var favoriteIds = this.shelf().map(id), at = favoriteIds.indexOf(id(item));
            if (at < 0) favoriteIds.push(id(item)); else favoriteIds.splice(at, 1);
            this.favorites = favoriteIds; this.save();
          }
        },
        moveStep: function (code) {
          // Reorder within the custom order of visible apps (persisted).
          var apps = this.visibleApps();
          var ids = apps.map(id);
          var delta = code === keys.LEFT ? -1 : code === keys.RIGHT ? 1 :
                      code === keys.UP ? -GRID_COLS : code === keys.DOWN ? GRID_COLS : 0;
          var to = Math.max(0, Math.min(ids.length - 1, this.index + delta));
          if (ids.length && to !== this.index) {
            var item = ids.splice(this.index, 1)[0];
            ids.splice(to, 0, item);
            this.index = to;
            this.appOrder = ids;
            this.save();
          }
        },
        select: function () {
          var vm = this;
          if (this.menu) { this.menuSelect(); return; }
          if (this.zone === "top") {
            if (this.index === 3) this.run(function () { return vm._platform.openSettings(); });
            else this.show(["home", "apps", "inputs", "", "prefs"][this.index]);
            return;
          }
          var item = this.list()[this.index];
          if (item == null) return;
          if (this.view === "inputs") this.run(function () { return vm._platform.changeSource(item.sourceId); });
          else if (this.view === "prefs") {
            if (this.index === 0) this.run(function () { return vm._platform.openSettings(); });
            else if (this.index === 1) { this.theme = ["auto", "dark", "light"][( ["auto", "dark", "light"].indexOf(this.theme) + 1) % 3]; this.save(); }
            else if (this.index === 2) this.show("edit");
            else if (this.index === 3) this.show("reorder");
            else if (this.index === 4) this._platform.refresh();
            else this.show("about");
          } else if (this.view === "about") this.show("prefs");
          else if (this.view === "edit") {
            var favoriteIds = this.shelf().map(id), at = favoriteIds.indexOf(id(item));
            if (at < 0) favoriteIds.push(id(item)); else favoriteIds.splice(at, 1);
            this.favorites = favoriteIds; this.save();
          } else if (this.view === "reorder") this.moving = !this.moving;
          else this.run(function () { return vm._platform.launchApp(item.appId); });
        },
        handleKey: function (code) {
          var vm = this;
          if (this.menu) {
            if (code === keys.BACK || code === keys.RETURN) { this.menu = null; return true; }
            if (code === keys.UP) this.menu.sel = Math.max(0, this.menu.sel - 1);
            else if (code === keys.DOWN) this.menu.sel = Math.min(this.menu.opts.length - 1, this.menu.sel + 1);
            // Ignore the tail of the long-press that opened the menu (auto-repeat
            // ENTER key-downs would otherwise pick an option instantly).
            else if (code === keys.ENTER && Date.now() - this.menu.t > 450) this.menuSelect();
            return true;
          }
          if (code === keys.BACK || code === keys.RETURN) {
            if (this._lp) { var lpFired = this._lp.fired; clearTimeout(this._lp.t); this._lp = null; if (!lpFired) return true; }
            if (this.moving) { this.moving = false; return true; }
            if (this.view !== "home" || this.zone !== "shelf") { this.show("home"); return true; }
            return false; // Let the vendor own Back from the main Home screen.
          }
          if (code === keys.ENTER) {
            // Long-press OK in All apps: select resolves on key-up (see _keyUp);
            // holding past 650ms opens the context menu instead.
            if (this.view === "apps" && !this.moving) {
              if (this._lp) return true; // auto-repeat while held
              this._lp = { fired: false, t: setTimeout(function () {
                if (vm._lp) { vm._lp.fired = true; vm.openMenu(); vm.announce(); }
              }, 650) };
              return true;
            }
            this.select(); return true;
          }
          if ([keys.LEFT, keys.RIGHT, keys.UP, keys.DOWN].indexOf(code) < 0) return false;
          if (this.moving) {
            if (this.view === "apps") { this.moveStep(code); return true; }
            var ids = this.shelf().map(id), delta = code === keys.LEFT ? -1 : code === keys.RIGHT ? 1 : 0;
            var to = Math.max(0, Math.min(ids.length - 1, this.index + delta));
            if (ids.length && to !== this.index) { var item = ids.splice(this.index, 1)[0]; ids.splice(to, 0, item); this.index = to; this.favorites = ids; this.save(); }
            return true;
          }
          if (this.zone === "top") {
            if (code === keys.DOWN) { this.zone = "shelf"; this.index = 0; }
            else if (code === keys.LEFT) this.index--; else if (code === keys.RIGHT) this.index++;
          } else if (code === keys.UP) {
            if (["apps", "edit", "inputs"].indexOf(this.view) >= 0 && this.index >= GRID_COLS) this.index -= GRID_COLS;
            else if (this.view === "prefs" && this.index > 0) this.index--;
            else { this.zone = "top"; this.index = 0; }
          } else if (code === keys.DOWN) {
            if (this.view === "home") this.show("inputs");
            else if (["apps", "edit", "inputs"].indexOf(this.view) >= 0) this.index += GRID_COLS;
            else if (this.view === "prefs") this.index++;
          } else if (code === keys.LEFT) this.index--; else if (code === keys.RIGHT) this.index++;
          this.clamp(); return true;
        }
      },
      render: function (h) {
        var vm = this, scale = this.width / 1920;
        var dark = this.theme === "dark" || (this.theme === "auto" && (this.now.getHours() >= 18 || this.now.getHours() < 7));
        var ink = dark ? "#f4f5ff" : "#17213c", muted = dark ? "#adb7d2" : "#465675";
        var surface = dark ? "rgba(18,25,48,0.94)" : "rgba(229,236,251,0.96)";
        var motion = !this.reducedMotion();
        var edge = dark ? "rgba(192,207,255,0.20)" : "rgba(44,66,114,0.25)";
        var shelf = this.view === "home" || this.view === "reorder";
        var items = this.list(), pageSize = shelf ? 8 : GRID_COLS * 3;
        var start = Math.floor(this.index / pageSize) * pageSize;
        var favoriteIds = this.shelf().map(id);
        var paused = !this.visualActive || this.visualHidden || !!this.menu || !sdk.router.isCurrentPathEqualTo("/Launcher");
        function box(x, y, w, height, more) {
          var s = { position: "absolute", left: x * scale + "px", top: y * scale + "px", boxSizing: "border-box" };
          if (w != null) s.width = w * scale + "px";
          if (height != null) s.height = height * scale + "px";
          Object.keys(more || {}).forEach(function (key) { s[key] = typeof more[key] === "number" ? more[key] * scale + "px" : more[key]; });
          return s;
        }
        function text(x, y, size, value, color, extra) {
          return h("div", { style: box(x, y, null, null, Object.assign({ fontSize: size, color: color || ink, lineHeight: "1.25" }, extra || {})) }, [value]);
        }
        function brandColor(label) {
          // Match names rather than regional catalog IDs. Colors follow the
          // artwork cached on the TV, including apps with black/white logos.
          var name = String(label || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          var palette = [
            [/netflix/, "#cf1027"], [/youtube|tubefree/, "#e62332"],
            [/amazonmusic/, "#28b9c8"], [/primevideo|amazonprime/, "#087cf5"],
            [/disney/, "#006b78"], [/appletv/, "#202124"],
            [/hbomax|^max$/, "#171e2a"], [/vidaakids/, "#4260f5"],
            [/^tubi/, "#7606c8"], [/^vhome/, "#343018"],
            [/crunchyroll/, "#f47521"], [/paramount/, "#0866f5"],
            [/spotify/, "#16b953"], [/mvshub/, "#65408a"],
            [/clarovideo/, "#d81920"], [/foxsports/, "#164c8c"],
            [/plutotv/, "#b6a900"], [/^vix/, "#ec521c"],
            [/mercadoplay/, "#d3b800"], [/haystack/, "#df3831"],
            [/toongoggles/, "#279bd1"], [/^dazn/, "#25282b"],
            [/^nba/, "#17418b"], [/uefa/, "#092b80"],
            [/^ufc/, "#cc0a13"], [/iwant/, "#4f16b0"],
            [/directv|^dgo$/, "#158ec2"], [/fanatiz/, "#e62c1a"],
            [/cindie/, "#c8102e"], [/wetv/, "#139dbd"],
            [/plex/, "#b77f13"], [/triller|^fite/, "#db1530"],
            [/freetv/, "#557c24"], [/appstore|tienda/, "#743cc0"],
            [/vodondemand/, "#e77b27"], [/deezer/, "#9132df"],
            [/mubi/, "#101e8e"], [/redbull/, "#173957"],
            [/vidaaart/, "#146778"], [/tvchannels|canales|^tv$/, "#7545ba"],
            [/browser|navegador/, "#34546c"], [/gamecenter|juegos/, "#6151ac"],
            [/media|multimedia/, "#365b69"], [/emanual/, "#485266"]
          ];
          for (var i = 0; i < palette.length; i++) if (palette[i][0].test(name)) return palette[i][1];
          // New sideloaded apps still get a stable individual accent offline.
          var accents = ["#4769a3", "#7445a3", "#ad405f", "#a65f32", "#36735c", "#287783", "#8b7232"];
          var hash = 0;
          for (var j = 0; j < name.length; j++) hash = ((hash * 31) + name.charCodeAt(j)) >>> 0;
          return accents[hash % accents.length];
        }
        function tile(item, index, x, y, size, compact) {
          var isApp = typeof item === "object" && item.appId != null && vm.view !== "inputs";
          var label = typeof item === "string" ? item : vm.view === "inputs" ? vm.sourceName(item) : item.appName;
          var icon = isApp && vm.localIcon(item);
          var focused = vm.zone === "shelf" && vm.index === index;
          var pinned = isApp && favoriteIds.indexOf(id(item)) >= 0;
          var moving = focused && vm.moving;
          var focusSlot = vm.zone === "shelf" ? vm.index - start : -1;
          var slot = index - start, shiftX = 0, shiftY = 0;
          if (focusSlot >= 0 && focusSlot < pageSize) {
            var focusCol = compact ? focusSlot % GRID_COLS : focusSlot;
            var column = compact ? slot % GRID_COLS : slot;
            shiftX = column < focusCol ? -14 : column > focusCol ? 14 : 0;
            if (compact) {
              var row = Math.floor(slot / GRID_COLS), focusRow = Math.floor(focusSlot / GRID_COLS);
              shiftY = row < focusRow ? -10 : row > focusRow ? 10 : 0;
            }
          }
          if (focused) shiftY -= 6;
          var artHeight = compact ? 138 : size;
          var content = [];
          content.push(h("div", { style: box(0, 0, size, artHeight, {
            borderRadius: compact ? 16 : 20, backgroundColor: isApp ? brandColor(label) : "#263758",
            backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.07), rgba(0,0,0,0.18))"
          }) }, [icon ? h("div", { style: box(20, 15, size - 40, artHeight - 30, {
            backgroundImage: "url(" + JSON.stringify(icon) + ")", backgroundSize: "contain", backgroundPosition: "center", backgroundRepeat: "no-repeat"
          }) }) : text(14, artHeight / 2 - 20, isApp ? 29 : 25, label, "#ffffff", {
            width: size - 28, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: "600"
          })]));
          if (compact && pinned) content.push(text(size - 29, 9, 18, "•", "#c8dbff"));
          content.push(text(compact ? 12 : 0, artHeight + 12, compact ? 23 : 25, label, ink, {
            width: size - (compact ? 24 : 0), overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", fontWeight: focused ? "600" : "400"
          }));
          return h("div", { key: (isApp ? "app-" + id(item) : vm.view === "inputs" ? "input-" + item.sourceId : "item-" + index),
            attrs: { role: "button", "aria-label": label + (moving ? ", moviendo" : ""), tabindex: focused ? "0" : "-1", "data-app-id": isApp ? id(item) : undefined },
            style: box(x, y, size, compact ? 187 : size + 46, {
              borderRadius: compact ? 18 : 21, backgroundColor: compact ? surface : "transparent",
              transform: "translate(" + shiftX * scale + "px," + shiftY * scale + "px) scale(" + (focused ? "1.10" : "1") + ")", transformOrigin: "50% 50%",
              transition: motion ? "transform 240ms cubic-bezier(0.2,0.75,0.25,1)" : "none", zIndex: focused ? "2" : "1"
            }), on: { click: function () { vm.zone = "shelf"; vm.index = index; vm.select(); } } }, [
              h("div", { style: box(-5, -5, size + 10, (compact ? 187 : size) + 10, {
                borderRadius: compact ? 23 : 26, border: 3 * scale + "px solid " + (moving ? "#a9e9ff" : "#ecf3ff"),
                opacity: focused ? "1" : "0", transition: motion ? "opacity 130ms ease-out" : "none", pointerEvents: "none"
              }) })
            ].concat(content));
        }
        var nodes = [
          h("div", { key: "galaxy", ref: "galaxy", class: "fmtv-galaxy", attrs: { "aria-hidden": "true" }, style: {
            position: "absolute", left: "-2%", top: "-2%", width: "104%", height: "104%",
            backgroundColor: "#080f23", backgroundImage: 'url("file:///hisenseUI/var/local/alvidaa-galaxy-v1.jpg")',
            backgroundSize: "cover", backgroundPosition: "center", transform: "scale(1.04)", animation: motion ? "fmtv-galaxy-drift 16s ease-in-out infinite alternate" : "none", animationPlayState: paused ? "paused" : "running"
          } }),
          h("div", { style: box(0, 0, 1920, 1080, {
            backgroundImage: dark ? "linear-gradient(to bottom, rgba(5,10,25,0.35), rgba(5,10,25,0.05) 40%, rgba(5,10,25,0.96) 100%)" :
              "linear-gradient(to bottom, rgba(226,235,255,0.91), rgba(226,235,255,0.28) 42%, rgba(226,235,255,0.97) 100%)"
          }) })];
        [[1050,290],[1435,350],[1720,225],[1260,470],[1575,585],[1810,440],[885,550],[1130,180]].forEach(function (point, i) {
          nodes.push(h("div", { key: "star-" + i, attrs: { "aria-hidden": "true" }, style: box(point[0], point[1], i % 3 === 0 ? 4 : 3, i % 3 === 0 ? 4 : 3, {
            borderRadius: 4, backgroundColor: "#d6e8ff", boxShadow: "0 0 " + 9 * scale + "px rgba(183,208,255,0.65)", opacity: "0.5",
            animation: motion ? "fmtv-star-breathe " + (5 + i % 4) + "s ease-in-out " + (-i * 0.7) + "s infinite alternate" : "none", animationPlayState: paused ? "paused" : "running"
          }) }));
        });
        if (!shelf) nodes.push(h("div", { style: box(0, 208, 1920, 872, { backgroundColor: dark ? "rgba(6,12,29,0.73)" : "rgba(228,236,253,0.85)" }) }));
        // Keep the five destinations and their indices exactly as before.
        var activeNav = { home: 0, reorder: 0, apps: 1, edit: 1, inputs: 2, prefs: 4, about: 4 }[this.view];
        var navX = [96, 239, 540, 720, 994], navW = [125, 282, 162, 256, 218];
        ["Inicio", "Todas las apps", "Entradas", "Ajustes de TV", "Preferencias"].forEach(function (label, i) {
          var focused = vm.zone === "top" && vm.index === i, active = activeNav === i;
          nodes.push(h("div", { key: "nav-" + i, attrs: { role: "button", "aria-label": label, tabindex: focused ? "0" : "-1" },
            style: box(navX[i], 73, navW[i], 62, { fontSize: 27, fontWeight: active || focused ? "600" : "400", textAlign: "center",
              lineHeight: 60 * scale + "px", color: focused ? "#111b32" : ink,
              backgroundColor: focused ? "#eef3ff" : active ? (dark ? "rgba(165,188,255,0.16)" : "rgba(51,79,134,0.12)") : "transparent",
              borderRadius: 31, border: 2 * scale + "px solid " + (focused ? "#ffffff" : "transparent"),
              transform: focused ? "scale(1.025)" : "scale(1)", transition: "transform 160ms ease-out"
            }), on: { click: function () { vm.zone = "top"; vm.index = i; vm.select(); } } }, [label]));
        });
        var hrs = this.now.getHours(), time = (hrs % 12 || 12) + ":" + ("0" + this.now.getMinutes()).slice(-2);
        var days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        var months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
        nodes.push(text(1490, 65, 44, time + (hrs >= 12 ? " pm" : " am"), ink, { width: 334, textAlign: "right", fontWeight: "400" }));
        nodes.push(text(1400, 122, 22, days[this.now.getDay()] + ", " + this.now.getDate() + " " + months[this.now.getMonth()], muted, { width: 424, textAlign: "right" }));
        var content = [], selected = items[this.index];
        if (shelf) {
          content.push(text(96, 350, 22, "TU ESPACIO", muted, { letterSpacing: 4 }));
          content.push(text(92, 395, 68, hrs < 12 ? "Buenos días." : hrs < 19 ? "Buenas tardes." : "Buenas noches.", ink, { fontWeight: "400" }));
          if (this.weather) content.push(text(96, 491, 25, this.weather.temp + "°C  ·  " + this.weather.desc + (this.weather.city ? "  ·  " + this.weather.city : ""), muted));
          var favoritesPage = items.slice(start, start + 8);
          var favoritesWidth = favoritesPage.length ? (favoritesPage.length - 1) * 218 + 196 : 800;
          var favoritesLeft = (1920 - favoritesWidth) / 2;
          content.push(text(favoritesLeft, 700, 24, this.view === "reorder" ? "Organiza tus favoritas" : "Tus favoritas", ink, { width: favoritesWidth, textAlign: "center", fontWeight: "600" }));
          favoritesPage.forEach(function (item, i) { content.push(tile(item, start + i, favoritesLeft + i * 218, 760, 196, false)); });
          if (items.length > 8) content.push(text(1510, 700, 23, (start + 1) + "–" + Math.min(start + 8, items.length) + " de " + items.length, muted, { width: 314, textAlign: "right" }));
        } else {
          var title = { apps: "Todas las aplicaciones", inputs: "Tus conexiones", edit: "Elige tus favoritas", prefs: "A tu manera", about: "Acerca de Free My TV" }[this.view] || "";
          if (this.view !== "apps") content.push(text(96, 230, 43, title, ink, { fontWeight: "600" }));
          if (this.view === "apps" || this.view === "edit" || this.view === "inputs") {
            if (this.view !== "apps") content.push(text(1470, 249, 23, items.length ? (start + 1) + "–" + Math.min(start + pageSize, items.length) + " de " + items.length : "0 aplicaciones", muted, { width: 354, textAlign: "right" }));
            items.slice(start, start + pageSize).forEach(function (item, i) {
              content.push(tile(item, start + i, 96 + (i % GRID_COLS) * 218, (vm.view === "apps" ? 290 : 330) + Math.floor(i / GRID_COLS) * 218, 192, true));
            });
          } else if (this.view === "prefs") {
            var labels = ["Ajustes de TV", "Tema: " + ({ dark: "Oscuro", light: "Claro", auto: "Automático" }[this.theme]), "Elegir favoritas", "Ordenar favoritas", "Actualizar apps y entradas", "Acerca de / licencias"];
            var descriptions = ["Imagen, sonido y conexiones de tu televisor.", "Una apariencia para cada momento del día.", "Ten siempre a mano lo que más disfrutas.", "Dales el lugar que tú quieras.", "Consulta de nuevo los servicios de la TV.", "Free My TV · integración nativa en VIDAA."];
            items.forEach(function (item, i) {
              var focused = vm.zone === "shelf" && vm.index === i;
              content.push(h("div", { key: "pref-" + i, attrs: { role: "button", "aria-label": labels[i], tabindex: focused ? "0" : "-1" },
                style: box(96, 330 + i * 99, 920, 82, { borderRadius: 18, backgroundColor: focused ? "#eaf0ff" : surface,
                  border: 2 * scale + "px solid " + (focused ? "#ffffff" : edge), transform: focused ? "translateX(8px)" : "translateX(0)", transition: "transform 160ms ease-out" }),
                on: { click: function () { vm.zone = "shelf"; vm.index = i; vm.select(); } }
              }, [text(28, 24, 27, labels[i], focused ? "#17213c" : ink)]));
            });
            content.push(text(1120, 370, 35, labels[this.zone === "shelf" ? this.index : 0], ink, { width: 650, fontWeight: "600" }));
            content.push(text(1120, 435, 27, descriptions[this.zone === "shelf" ? this.index : 0], muted, { width: 620, lineHeight: "1.5" }));
          } else if (this.view === "about") {
            content.push(text(96, 340, 32, "Free My TV · native VIDAA port"), text(96, 414, 26, "Diseño original: felipericardo/tv-launcher · f2d984c · MIT", muted),
              text(96, 470, 26, "Integración nativa: alvidaa. Controles y servicios originales de la TV.", muted),
              text(96, 526, 26, "Galaxia y presentación visual: edición local · 2026", muted));
            content.push(h("div", { attrs: { role: "button", "aria-label": "Volver", tabindex: "0" }, style: box(96, 642, 220, 72, { backgroundColor: "#eaf0ff", borderRadius: 20, textAlign: "center", lineHeight: 72 * scale + "px", color: "#17213c", fontSize: 27 }), on: { click: function () { vm.select(); } } }, ["Volver"]));
          }
        }
        if (!items.length) content.push(text(96, shelf ? 745 : 395, 29, this.view === "inputs" ? "No hay entradas disponibles." : "Tu espacio está listo para tus apps.", ink),
          text(96, shelf ? 805 : 455, 25, "Usa Todas las apps o Ajustes de TV para continuar.", muted));
        nodes.push(h("div", { key: "view-" + this.view + "-" + start, class: "fmtv-view", style: box(0, 0, 1920, 1080, { pointerEvents: "none", animation: motion ? (shelf ? "fmtv-view-in 240ms" : "fmtv-page-in 280ms") + " ease-out both" : "none" }) },
          content.map(function (node) { if (node && node.data && node.data.on) node.data.style.pointerEvents = "auto"; return node; })));
        var hint = this.moving ? "Flechas: mover    ·    OK o Atrás: terminar" : this.view === "reorder" ? "OK: elegir o soltar    ·    Flechas: mover    ·    Atrás: volver" :
          this.view === "apps" ? "OK: abrir    ·    Mantén OK: organizar    ·    Atrás: inicio" : this.view === "edit" ? "OK: fijar o quitar de inicio    ·    Atrás: volver" :
          shelf ? "OK: abrir    ·    ↑ Menú    ·    ↓ Entradas" : "OK: seleccionar    ·    Atrás: volver";
        if (!shelf) nodes.push(h("div", { style: box(96, 985, 1728, 1, { backgroundColor: edge }) }));
        if (this.view === "apps") {
          nodes.push(text(96, 1010, 23, items.length ? (start + 1) + "–" + Math.min(start + pageSize, items.length) + " de " + items.length + " apps" : "0 apps", muted));
        } else if (this.view !== "home") nodes.push(text(96, 1010, 23, hint, muted));
        if (this.view === "apps" && selected && !this.menu) nodes.push(text(1395, 1010, 23, this.moving ? "Moviendo: " + selected.appName : selected.appName, muted, { width: 429, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }));
        // Keep actionable failures visible; normal diagnostic counts stay out of Home.
        if (/failed|Could not|error/i.test(this.status)) nodes.push(text(96, shelf ? 650 : 953, 21, this.status, dark ? "#ffd1a8" : "#7d330e", { width: 1728, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }));
        if (this.menu) {
          nodes.push(h("div", { key: "menu-dim", style: box(0, 0, 1920, 1080, { backgroundColor: "rgba(2,6,18,0.68)", zIndex: "9" }) }));
          var mItem = this.visibleApps()[this.index], mIcon = mItem && this.localIcon(mItem);
          var menuNodes = [text(40, 38, 20, "ORGANIZAR APLICACIÓN", muted, { letterSpacing: 2 }), text(40, 88, 37, mItem ? mItem.appName : "", ink, { width: 490, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: "600" })];
          if (mIcon) menuNodes.push(h("div", { style: box(40, 155, 82, 82, { backgroundImage: "url(" + JSON.stringify(mIcon) + ")", backgroundSize: "contain", backgroundPosition: "center", backgroundRepeat: "no-repeat" }) }));
          menuNodes.push(text(mIcon ? 144 : 40, 178, 24, "Dale tu lugar.", muted));
          this.menu.opts.forEach(function (opt, i) {
            var focused = vm.menu.sel === i;
            menuNodes.push(h("div", { key: opt.act, attrs: { role: "button", "aria-label": opt.label, tabindex: focused ? "0" : "-1" },
              style: box(24, 278 + i * 94, 532, 78, { backgroundColor: focused ? "#edf3ff" : (dark ? "rgba(255,255,255,0.06)" : "rgba(38,61,114,0.07)"),
                borderRadius: 17, border: 2 * scale + "px solid " + (focused ? "#ffffff" : "transparent"), transform: focused ? "translateX(4px)" : "translateX(0)", transition: "transform 150ms ease-out" }),
              on: { click: function () { vm.menu.sel = i; vm.menuSelect(); } }
            }, [text(26, 22, 27, opt.label, focused ? "#17213c" : ink)]));
          });
          menuNodes.push(text(40, 599, 23, "OK: elegir    ·    Atrás: cerrar", muted));
          nodes.push(h("div", { key: "menu", class: "fmtv-menu", attrs: { role: "dialog", "aria-label": "Organizar aplicación", "aria-modal": "true" },
            style: box(1244, 214, 580, 670, { borderRadius: 28, backgroundColor: dark ? "#121a30" : "#e5ecfb", zIndex: "10", border: 1 * scale + "px solid " + edge, animation: motion ? "fmtv-view-in 170ms ease-out both" : "none" }) }, menuNodes));
        }
        return h("div", { attrs: { id: "fmtv-native" }, style: { position: "absolute", left: "0", top: "0", width: "100%", height: "100%", overflow: "hidden", backgroundColor: "#080f23", color: ink, fontFamily: "Arial, sans-serif" } }, nodes);
      }
    };
  };
}(self));
