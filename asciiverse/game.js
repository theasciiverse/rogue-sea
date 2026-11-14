// Rogue Sea in the terminal: how the page is laid out on the screen. The
// game draws its sea in square tiles with fastiles, a WebGL renderer: a
// CP437 bitmap font, a glyph and a palette index per tile. Here a small
// stand-in for WebGL takes what fastiles uploads (the glyph and style of
// every tile, the palette) and each square tile becomes two terminal cells
// (cells are twice as tall as wide). The log and status sidebar, the
// title page and the tutorial notes are the page's HTML.
/* BUILD {"files": []} */

var GAME = {
    id: "rogue-sea",
    idleMs: 200,
    frameMs: 50,
    usage: "rogue-sea [--seed N] [--version]\n\n" +
        "Rogue Sea by Ondrej Zara (7DRL 2021), in the terminal. Steer and sail\n" +
        "with the arrows, A W D or H K L; the keys for the rest are shown in the\n" +
        "game; + and - zoom. Ctrl+C or Ctrl+Q quits. Best at 120x40 or larger.\n" +
        "--seed N gives the same seas each time.\n" +
        "ROGUE_SEA_LOG=debug logs every key to the state folder.\n"
};

// ------------------------------------------------------------ WebGL stand-in

GAME.scene = null;
GAME.webgl = function (canvas) {
    var ATTRIBS = ["position", "uv", "glyph", "style"], UNIFORMS = ["tileSize", "viewportSize", "font", "palette"];
    var st = { canvas: canvas, vw: 0, vh: 0, ts: 1, glyph: null, style: null, palette: null, unit: 0, bound: null };
    var noop = function () {};
    var gl = {
        canvas: canvas,
        ARRAY_BUFFER: 0x8892, STATIC_DRAW: 0x88E4, DYNAMIC_DRAW: 0x88E8, TRIANGLES: 4, UNSIGNED_SHORT: 0x1403, UNSIGNED_BYTE: 0x1401,
        VERTEX_SHADER: 0x8B31, FRAGMENT_SHADER: 0x8B30, COMPILE_STATUS: 0x8B81, LINK_STATUS: 0x8B82,
        ACTIVE_ATTRIBUTES: 0x8B89, ACTIVE_UNIFORMS: 0x8B86, TEXTURE_2D: 0x0DE1, TEXTURE0: 0x84C0, TEXTURE1: 0x84C1,
        TEXTURE_MAG_FILTER: 0x2800, TEXTURE_MIN_FILTER: 0x2801, NEAREST: 0x2600, RGBA: 0x1908,
        createProgram: function () { return {}; }, createShader: function () { return {}; },
        shaderSource: noop, compileShader: noop, attachShader: noop, linkProgram: noop, useProgram: noop,
        getShaderInfoLog: function () { return ""; }, getProgramInfoLog: function () { return ""; },
        getShaderParameter: function () { return true; },
        getProgramParameter: function (p, what) { return what == 0x8B89 ? ATTRIBS.length : what == 0x8B86 ? UNIFORMS.length : true; },
        getActiveAttrib: function (p, i) { return { name: ATTRIBS[i] }; },
        getActiveUniform: function (p, i) { return { name: UNIFORMS[i] }; },
        getUniformLocation: function (p, name) { return name; },
        enableVertexAttribArray: noop, uniform1i: noop, viewport: noop, texParameteri: noop, deleteBuffer: noop,
        uniform2ui: function (loc, a, b) { if (loc == "viewportSize") { st.vw = a; st.vh = b; } },
        uniform2uiv: function (loc, v) { if (loc == "tileSize") st.ts = v[0] || 1; },
        createTexture: function () { return {}; }, bindTexture: noop,
        activeTexture: function (u) { st.unit = u - 0x84C0; },
        texImage2D: function () { var data = arguments[arguments.length - 1]; if (st.unit == 1) st.palette = data; },
        createBuffer: function () { return {}; },
        bindBuffer: function (t, b) { st.bound = b; },
        vertexAttribIPointer: function (index) { if (st.bound) st.bound.attrib = ATTRIBS[index]; },
        bufferData: function (t, data) {
            if (!st.bound) return;
            if (st.bound.attrib == "glyph") st.glyph = data;
            if (st.bound.attrib == "style") st.style = data;
        },
        drawArrays: function () { DOM.touch(); }
    };
    GAME.scene = st;
    return gl;
};

// the palette canvas: fastiles fills one pixel per colour
GAME.palette = function (c) {
    if (!c || !c.ops) return [];
    if (c._rottyPal && c._rottyPalN == c.ops.length) return c._rottyPal;
    var pal = [];
    c.ops.forEach(function (op) { if (op.op == "fillRect") pal[op.x] = TERM.color(op.color) || [0, 0, 0]; });
    c._rottyPal = pal; c._rottyPalN = c.ops.length;
    return pal;
};

// code page 437, as the REXPaint fonts draw it
GAME.CP437 = (function () {
    var low = " ☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼";
    var high = "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";
    var t = Array.from(low);
    for (var i = 32; i < 127; i++) t.push(String.fromCharCode(i));
    t.push("⌂");
    return t.concat(Array.from(high));
})();
// glyphs that join their neighbour on the right when a tile is two cells
GAME.WIDE = "-=─═~≈░▒▓█▀▄■#_▬";

GAME.drawScene = function (x0, y0, w, h) {
    var st = GAME.scene;
    if (!st || !st.glyph || !st.style || !st.ts) return;
    var tcx = Math.round(st.vw / st.ts), tcy = Math.round(st.vh / st.ts);
    if (!tcx || !tcy) return;
    var pal = GAME.palette(st.palette);
    var tw = w >> 1, th = h;
    // the middle of the scene when it is bigger than the screen, centred
    // when smaller
    var sx = tcx > tw ? (tcx - tw) >> 1 : 0, sy = tcy > th ? (tcy - th) >> 1 : 0;
    var ox = x0 + (tcx < tw ? (tw - tcx) : 0), oy = y0 + (tcy < th ? (th - tcy) >> 1 : 0);
    var cw = Math.min(tw, tcx), ch = Math.min(th, tcy);
    for (var y = 0; y < ch; y++) {
        for (var x = 0; x < cw; x++) {
            var i = ((y + sy) * tcx + x + sx) * 6 + 2;
            var g = st.glyph[i], s = st.style[i];
            var fg = pal[s & 0xFF] || [255, 255, 255], bg = pal[s >> 8] || [0, 0, 0];
            var c = GAME.CP437[g] || "?", X = ox + x * 2, Y = oy + y;
            TERM.put(X, Y, c, fg, bg);
            TERM.put(X + 1, Y, GAME.WIDE.indexOf(c) >= 0 ? c : " ", fg, bg);
        }
    }
};

// ------------------------------------------------------------ HTML

GAME.has = function (n, c) { return !!(n && n.classList && n.classList.contains(c)); };
GAME.text = function (el, w, base) { return PANEL.lines(el, w, base); };
GAME.css = function (n) {
    if (n.tagName == "STRONG") return { fg: GAME.inAbout ? "#ffffff" : null, bold: !GAME.inAbout };
    if (GAME.has(n, "gold")) return { fg: "gold" };
    if (n.tagName == "DT") return { bold: true };
    return null;
};
GAME.runs = function (line, x, y, w, fg, bg) {
    var cx = x;
    line.forEach(function (r) {
        Array.from(r.t).forEach(function (ch) {
            if (cx < x + w) TERM.put(cx, y, ch, r.fg || fg, bg || null, false, r.bold);
            cx++;
        });
    });
    return cx - x;
};
GAME.len = function (l) { var n = 0; l.forEach(function (r) { n += Array.from(r.t).length; }); return n; };

// the title page: the ship in sienna with white sails over a blue sea, the
// words, and the start line and the credits at the bottom
GAME.about = function (node) {
    var W = TERM.w, H = TERM.h;
    TERM.fillRect(0, 0, W, H, "#000");
    GAME.inAbout = true;
    var y = 1;
    var h1 = node.querySelector("h1");
    if (h1) { var t = h1.textContent; TERM.text(((W - t.length) / 2) | 0, y, t, "gold"); y += 2; }
    var pre = node.querySelector("pre");
    if (pre) {
        var rows = [[]];
        var walk = function (n, fg) {
            if (n.nodeType == 3) { n.data.split("\n").forEach(function (part, i) { if (i) rows.push([]); if (part) rows[rows.length - 1].push({ t: part, fg: fg, bold: true }); }); return; }
            var f = GAME.has(n, "sail") ? "#ffffff" : GAME.has(n, "sea") ? "dodgerblue" : fg;
            n.childNodes.forEach(function (c) { walk(c, f); });
        };
        walk(pre, "sienna");
        while (rows.length && !rows[0].map(function (r) { return r.t; }).join("").trim()) rows.shift();
        while (rows.length && !rows[rows.length - 1].map(function (r) { return r.t; }).join("").trim()) rows.pop();
        var pw = 0; rows.forEach(function (r) { pw = Math.max(pw, GAME.len(r)); });
        var px = Math.max(0, ((W - pw) / 2) | 0);
        rows.forEach(function (r) { GAME.runs(r, px, y++, W - px); });
        y++;
    }
    var w = Math.min(W - 4, 80), x = ((W - w) / 2) | 0;
    DOM.query(node, "p", false).forEach(function (p) {
        if (p.id == "start") return;
        GAME.text(p, w, { fg: "#aaaaaa" }).forEach(function (l) { GAME.runs(l, x, y++, w); });
        y++;
    });
    // the bottom: "press Enter" in two thirds, the credits in one
    var start = node.querySelector("#start"), credits = node.querySelector("#credits");
    var cw = Math.max(24, Math.round(W / 3)), sw = W - cw - 2;
    var cl = [];
    if (credits) {
        cl.push([{ t: "Credits", fg: "#ffffff" }]);
        cl.push([]);
        credits.children.forEach(function (n) {
            var ls = GAME.text(n, cw - (n.tagName == "DD" ? 2 : 0), { fg: "#aaaaaa" });
            ls.forEach(function (l) { cl.push(n.tagName == "DD" ? [{ t: "  ", fg: null }].concat(l) : l.map(function (r) { return { t: r.t, fg: r.fg, bold: true }; })); });
        });
    }
    var by = Math.max(y, H - cl.length - 1);
    if (start) {
        var sl = GAME.text(start, sw, { fg: "#aaaaaa" });
        var sy = by + Math.max(0, ((cl.length - sl.length) / 2) | 0);
        sl.forEach(function (l, j) { GAME.runs(l, ((sw - GAME.len(l)) / 2) | 0, sy + j, sw); });
    }
    var cx = W - cw - 1;
    cl.forEach(function (l, j) { if (by + j < H) GAME.runs(l, j == 0 ? cx + (((cw - 7) / 2) | 0) : cx, by + j, cw); });
    GAME.inAbout = false;
};

// the sidebar: the log, then the status list with its values on the right
GAME.aside = function (aside, x, w, H) {
    var BG = "#b8915f", FG = "#000000";
    TERM.fillRect(x, 0, w, H, BG);
    for (var y = 0; y < H; y++) TERM.put(x, y, "│", "saddlebrown", BG);
    var ix = x + 2, iw = w - 3;
    var status = aside.querySelector("#status"), log = aside.querySelector("#log");
    var rows = status ? status.children.filter(function (d) { return !d.hidden; }) : [];
    var sy = H - rows.length;
    for (var i = x + 1; i < x + w; i++) TERM.put(i, sy - 1, "─", "saddlebrown", BG);
    var icons = { cannonballs: "•", coconuts: "o", gold: "$" };
    rows.forEach(function (d, j) {
        var dt = d.querySelector("dt"), dd = d.querySelector("dd");
        TERM.text(ix, sy + j, dt ? dt.textContent : "", FG, BG);
        var cells = TERM.cells[(sy + j) * TERM.w + ix]; if (cells) for (var k = 0; k < (dt ? dt.textContent.length : 0); k++) TERM.cells[(sy + j) * TERM.w + ix + k].bold = true;
        var v = dd ? dd.textContent : "", ic = icons[d.id] ? " " + icons[d.id] : "";
        var room = iw - (dt ? dt.textContent.length : 0) - 1 - ic.length;
        if (v.length > room) v = v.slice(0, Math.max(0, room - 1)) + "…";
        var fg = d.id == "gold" ? "gold" : d.id == "hp" ? "saddlebrown" : FG;
        TERM.text(x + w - 1 - v.length - ic.length, sy + j, v, fg, BG);
        if (ic) TERM.text(x + w - 1 - ic.length, sy + j, ic, FG, BG);
        if (d.id == "hp") for (var k2 = 0; k2 < v.length; k2++) TERM.cells[(sy + j) * TERM.w + x + w - 1 - v.length + k2].bold = true;
    });
    if (log) {
        var lines = [];
        log.childNodes.forEach(function (n) {
            if (n.nodeType != 1) return;
            var ls = GAME.text(n, iw, { fg: FG });
            if (lines.length && ls.length) lines.push([]);
            ls.forEach(function (l) { lines.push(l); });
        });
        var lh = sy - 2;
        if (lines.length > lh) lines = lines.slice(lines.length - lh);
        lines.forEach(function (l, j) { GAME.runs(l, ix, j, iw, FG, BG); });
    }
};

GAME.asideWidth = function () {
    var aside = document.querySelector("aside");
    if (!aside || GAME.has(aside, "narrow")) return 0;
    return Math.max(24, Math.round(TERM.w * 0.25));
};

// the main box in "pixels": as many 20 px tiles as there are pairs of cells
GAME.box = function (el) {
    if (el.tagName == "MAIN") return { x: 0, y: 0, w: ((TERM.w - GAME.asideWidth()) >> 1) * 20, h: TERM.h * 20 };
    return null;
};

GAME.layout = function () {
    var W = TERM.w, H = TERM.h;
    var about = document.getElementById("about");
    if (about && about.parentNode && about.style.opacity !== "0") { GAME.about(about); return; }
    var aw = GAME.asideWidth(), mw = W - aw;
    TERM.fillRect(0, 0, mw, H, "#000");
    GAME.drawScene(0, 0, mw, H);
    var tut = document.getElementById("tutorial");
    if (tut && !tut.hidden) GAME.tutorial(tut, mw, H);
    var aside = document.querySelector("aside");
    if (aw && aside) GAME.aside(aside, mw, aw, H);
};

// the tutorial notes, a parchment box over the sea
GAME.tutorial = function (node, mw, H) {
    var w = Math.min(mw - 4, 60);
    var ls = [];
    node.childNodes.forEach(function (n) {
        if (n.nodeType == 3 && !n.data.trim()) return;
        var part = n.nodeType == 3 ? GAME.text({ nodeType: 1, tagName: "P", style: {}, childNodes: [n] }, w - 4, { fg: "#000" }) : GAME.text(n, w - 4, { fg: "#000" });
        if (ls.length && part.length) ls.push([]);
        ls = ls.concat(part);
    });
    var bh = ls.length + 2, bx = ((mw - w) / 2) | 0, by = 1;
    TERM.fillRect(bx, by, w, bh, "#b8915f");
    ls.forEach(function (l, j) { GAME.runs(l, bx + 2, by + 1 + j, w - 4, "#000", "#b8915f"); });
};

GAME.snapshot = function () {
    var st = GAME.scene;
    return "scene=" + (st ? Math.round(st.vw / st.ts) + "x" + Math.round(st.vh / st.ts) + "@" + st.ts : "-") +
        " glyph=" + (st && st.glyph ? st.glyph.length : "-") + " pal=" + (st && st.palette ? GAME.palette(st.palette).length : "-") + " aside=" + GAME.asideWidth() + " log=" + JSON.stringify(((document.getElementById("log") || {}).textContent || "").slice(-60));
};

// --seed N: the game's Math.random seeded, the same seas each time
GAME.seed = null;
GAME.arg = function (a, b) {
    if (a == "--seed" && b) { GAME.seed = parseInt(b, 10) >>> 0; return true; }
    return false;
};
GAME.before = function () {
    if (GAME.seed === null) return;
    var s = GAME.seed || 1;
    Math.random = function () {   // mulberry32
        s = (s + 0x6D2B79F5) >>> 0;
        var t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};
